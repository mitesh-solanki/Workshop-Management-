import "server-only";

import { writeAuditLog } from "@/lib/audit";
import {
  calendarDateKeyBoundsUtc,
  calendarDayBoundsUtc,
  WORKSHOP_TIME_ZONE,
} from "@/lib/calendar-day";
import { ForbiddenError } from "@/lib/errors";
import { toPaise, type Paise } from "@/lib/money";
import { requireRole, type RoleSession } from "@/lib/rbac";
import {
  countJobsCompletedOnDay,
  countOpenJobsNow,
  findGarageNameForSummary,
  listExpensesOnDay,
  listInspectionsCreatedOnDay,
  listInvoicesFinalizedOnDay,
  listJobCardsCreatedOnDay,
  listOpenDuesInvoices,
  listPaymentsReceivedOnDay,
} from "@/modules/daily-summary/repo";
import { buildDailySummaryPdfBuffer } from "@/modules/daily-summary/pdf";
import { dailySummaryDateSchema } from "@/modules/daily-summary/schema";

const ACCESS_ROLES = ["OWNER", "MANAGER", "ACCOUNTANT"] as const;

export type DailySummaryKpis = {
  jobCardsCreated: number;
  inspections: number;
  jobsCompleted: number;
  invoicesFinalized: number;
  collectedPaise: Paise;
  refundedPaise: Paise;
  expensePaise: Paise;
  cashCollectedPaise: Paise;
  upiCollectedPaise: Paise;
  cardCollectedPaise: Paise;
  openJobsNow: number;
  openDuesPaise: Paise;
  openDuesCount: number;
};

export type DailySummaryView = {
  dateKey: string;
  garageName: string;
  kpis: DailySummaryKpis;
  jobCards: Array<{
    id: string;
    jobCardNumber: number;
    status: string;
    createdAt: Date;
    customerName: string;
    registrationNumber: string;
  }>;
  inspections: Array<{
    id: string;
    createdAt: Date;
    customerName: string;
    registrationNumber: string;
    serviceOrderId: string | null;
  }>;
  invoices: Array<{
    id: string;
    invoiceNumber: string | null;
    serviceOrderId: string;
    jobCardNumber: number;
    customerName: string;
    registrationNumber: string;
    totalPaise: Paise;
    pendingPaise: Paise;
    finalizedAt: Date;
  }>;
  payments: Array<{
    id: string;
    receivedAt: Date;
    method: string;
    amountPaise: Paise;
    isRefund: boolean;
    customerName: string;
    invoiceNumber: string | null;
    invoiceId: string;
    serviceOrderId: string;
  }>;
  expenses: Array<{
    id: string;
    spentAt: Date;
    category: string;
    status: string;
    method: string | null;
    amountPaise: Paise;
    note: string | null;
  }>;
  openDues: Array<{
    id: string;
    invoiceNumber: string | null;
    serviceOrderId: string;
    customerName: string;
    totalPaise: Paise;
    amountPaidPaise: Paise;
    pendingPaise: Paise;
  }>;
};

function assertAccess(session: RoleSession) {
  requireRole(session, ACCESS_ROLES);
}

function resolveDayBounds(dateKey: string | undefined | null) {
  if (!dateKey || !dateKey.trim()) {
    const bounds = calendarDayBoundsUtc(new Date(), WORKSHOP_TIME_ZONE);
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: WORKSHOP_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const d = parts.find((p) => p.type === "day")?.value;
    return {
      dateKey: `${y}-${m}-${d}`,
      start: bounds.start,
      end: bounds.end,
    };
  }

  const parsed = dailySummaryDateSchema.parse(dateKey);
  const bounds = calendarDateKeyBoundsUtc(parsed)!;
  return { dateKey: parsed, start: bounds.start, end: bounds.end };
}

/** Split a payment into cash / UPI / card for day KPIs. */
export function paymentMethodBreakdown(payment: {
  method: string;
  amountPaise: number;
  cashPaise: number;
  upiPaise: number;
  cardPaise: number;
}): { cash: Paise; upi: Paise; card: Paise } {
  const cash = toPaise(payment.cashPaise);
  const upi = toPaise(payment.upiPaise);
  const card = toPaise(payment.cardPaise);
  if (cash + upi + card > 0) {
    return { cash, upi, card };
  }
  const amount = toPaise(payment.amountPaise);
  if (payment.method === "UPI") return { cash: 0, upi: amount, card: 0 };
  if (payment.method === "CARD") return { cash: 0, upi: 0, card: amount };
  return { cash: amount, upi: 0, card: 0 };
}

export async function getDailySummary(
  session: RoleSession,
  dateKey?: string | null,
): Promise<DailySummaryView> {
  assertAccess(session);
  const day = resolveDayBounds(dateKey);
  const garage = await findGarageNameForSummary(session.garageId);
  if (!garage) {
    throw new ForbiddenError();
  }

  const [
    jobCardsRaw,
    inspectionsRaw,
    jobsCompleted,
    invoicesRaw,
    paymentsRaw,
    expensesRaw,
    openJobsNow,
    openDues,
  ] = await Promise.all([
    listJobCardsCreatedOnDay(session.garageId, day.start, day.end),
    listInspectionsCreatedOnDay(session.garageId, day.start, day.end),
    countJobsCompletedOnDay(session.garageId, day.start, day.end),
    listInvoicesFinalizedOnDay(session.garageId, day.start, day.end),
    listPaymentsReceivedOnDay(session.garageId, day.start, day.end),
    listExpensesOnDay(session.garageId, day.start, day.end),
    countOpenJobsNow(session.garageId),
    listOpenDuesInvoices(session.garageId),
  ]);

  let collectedPaise = 0;
  let refundedPaise = 0;
  let cashCollectedPaise = 0;
  let upiCollectedPaise = 0;
  let cardCollectedPaise = 0;

  for (const payment of paymentsRaw) {
    const amount = toPaise(payment.amountPaise);
    if (payment.isRefund) {
      refundedPaise += amount;
      continue;
    }
    collectedPaise += amount;
    const parts = paymentMethodBreakdown(payment);
    cashCollectedPaise += parts.cash;
    upiCollectedPaise += parts.upi;
    cardCollectedPaise += parts.card;
  }

  const expensePaise = expensesRaw
    .filter((row) => row.status === "PAID")
    .reduce((sum, row) => sum + toPaise(row.amountPaise), 0);

  const openDuesPaise = openDues.reduce(
    (sum, row) => sum + row.pendingPaise,
    0,
  );

  const invoices = invoicesRaw.map((row) => {
    const creditTotal = row.creditNotes.reduce(
      (sum, note) => sum + toPaise(note.totalPaise),
      0,
    );
    const total = toPaise(row.totalPaise);
    const paid = toPaise(row.amountPaidPaise);
    return {
      id: row.id,
      invoiceNumber: row.invoiceNumber,
      serviceOrderId: row.serviceOrderId,
      jobCardNumber: row.serviceOrder.jobCardNumber,
      customerName: row.customer.name,
      registrationNumber: row.serviceOrder.vehicle.registrationNumber,
      totalPaise: total,
      pendingPaise: Math.max(0, total - creditTotal - paid),
      finalizedAt: row.finalizedAt!,
    };
  });

  return {
    dateKey: day.dateKey,
    garageName: garage.name,
    kpis: {
      jobCardsCreated: jobCardsRaw.length,
      inspections: inspectionsRaw.length,
      jobsCompleted,
      invoicesFinalized: invoices.length,
      collectedPaise,
      refundedPaise,
      expensePaise,
      cashCollectedPaise,
      upiCollectedPaise,
      cardCollectedPaise,
      openJobsNow,
      openDuesPaise,
      openDuesCount: openDues.length,
    },
    jobCards: jobCardsRaw.map((row) => ({
      id: row.id,
      jobCardNumber: row.jobCardNumber,
      status: row.status,
      createdAt: row.createdAt,
      customerName: row.customer.name,
      registrationNumber: row.vehicle.registrationNumber,
    })),
    inspections: inspectionsRaw.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      customerName: row.customer.name,
      registrationNumber: row.vehicle.registrationNumber,
      serviceOrderId: row.serviceOrderId,
    })),
    invoices,
    payments: paymentsRaw.map((row) => ({
      id: row.id,
      receivedAt: row.receivedAt,
      method: row.method,
      amountPaise: toPaise(row.amountPaise),
      isRefund: row.isRefund,
      customerName: row.invoice.customer.name,
      invoiceNumber: row.invoice.invoiceNumber,
      invoiceId: row.invoice.id,
      serviceOrderId: row.invoice.serviceOrderId,
    })),
    expenses: expensesRaw.map((row) => ({
      id: row.id,
      spentAt: row.spentAt,
      category: row.category,
      status: row.status,
      method: row.method,
      amountPaise: toPaise(row.amountPaise),
      note: row.note,
    })),
    openDues: openDues.slice(0, 20),
  };
}

export async function downloadDailySummaryPdf(
  session: RoleSession,
  dateKey?: string | null,
) {
  const summary = await getDailySummary(session, dateKey);
  const buffer = await buildDailySummaryPdfBuffer(summary);

  await writeAuditLog({
    garageId: session.garageId,
    actorId: session.userId,
    action: "daily_summary.downloaded",
    entity: "DailySummary",
    entityId: summary.dateKey,
    meta: { dateKey: summary.dateKey },
  });

  return { buffer, dateKey: summary.dateKey, garageName: summary.garageName };
}

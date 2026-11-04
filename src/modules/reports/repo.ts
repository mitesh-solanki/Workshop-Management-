import "server-only";

import { prisma } from "@/lib/db";
import {
  pendingBalancePaise,
  sumCreditNotesPaise,
} from "@/modules/billing/balance";
import {
  bucketKey,
  buildEmptyBuckets,
  type ReportBucket,
  type ReportRange,
} from "@/modules/reports/period";

export type ReportSeriesPoint = {
  key: string;
  label: string;
  amountPaise: number;
  href?: string;
};

export type ReportTableRow = {
  id: string;
  label: string;
  secondary: string | null;
  date: Date;
  amountPaise: number;
};

function fillSeries(
  keys: string[],
  totals: Map<string, number>,
): ReportSeriesPoint[] {
  return keys.map((key) => ({
    key,
    label: key,
    amountPaise: totals.get(key) ?? 0,
  }));
}

function aggregateByBucket(
  rows: Array<{ at: Date; amountPaise: number }>,
  range: ReportRange,
): ReportSeriesPoint[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const key = bucketKey(row.at, range.bucket);
    totals.set(key, (totals.get(key) ?? 0) + row.amountPaise);
  }
  return fillSeries(
    buildEmptyBuckets(range.from, range.to, range.bucket),
    totals,
  );
}

export async function loadSalesReport(garageId: string, range: ReportRange) {
  const invoices = await prisma.invoice.findMany({
    where: {
      garageId,
      status: "FINALIZED",
      finalizedAt: { gte: range.from, lte: range.to },
    },
    select: {
      id: true,
      invoiceNumber: true,
      totalPaise: true,
      finalizedAt: true,
      customer: { select: { name: true } },
    },
    orderBy: { finalizedAt: "desc" },
  });

  const series = aggregateByBucket(
    invoices
      .filter((row) => row.finalizedAt != null)
      .map((row) => ({
        at: row.finalizedAt!,
        amountPaise: row.totalPaise,
      })),
    range,
  );

  const rows: ReportTableRow[] = invoices.map((invoice) => ({
    id: invoice.id,
    label: invoice.invoiceNumber ?? invoice.id,
    secondary: invoice.customer.name,
    date: invoice.finalizedAt ?? range.to,
    amountPaise: invoice.totalPaise,
  }));

  const totalPaise = invoices.reduce((sum, row) => sum + row.totalPaise, 0);
  return { series, rows, totalPaise, count: invoices.length };
}

export async function loadPaymentsReport(
  garageId: string,
  range: ReportRange,
) {
  const payments = await prisma.payment.findMany({
    where: {
      garageId,
      isRefund: false,
      status: "PAID",
      receivedAt: { gte: range.from, lte: range.to },
    },
    select: {
      id: true,
      amountPaise: true,
      method: true,
      receivedAt: true,
      invoice: {
        select: {
          invoiceNumber: true,
          customer: { select: { name: true } },
        },
      },
    },
    orderBy: { receivedAt: "desc" },
  });

  const series = aggregateByBucket(
    payments.map((row) => ({
      at: row.receivedAt,
      amountPaise: row.amountPaise,
    })),
    range,
  );

  const rows: ReportTableRow[] = payments.map((payment) => ({
    id: payment.id,
    label: payment.invoice.invoiceNumber ?? payment.id,
    secondary: `${payment.invoice.customer.name} · ${payment.method}`,
    date: payment.receivedAt,
    amountPaise: payment.amountPaise,
  }));

  const totalPaise = payments.reduce((sum, row) => sum + row.amountPaise, 0);
  return { series, rows, totalPaise, count: payments.length };
}

export async function loadCreditNotesReport(
  garageId: string,
  range: ReportRange,
) {
  const notes = await prisma.creditNote.findMany({
    where: {
      garageId,
      createdAt: { gte: range.from, lte: range.to },
    },
    select: {
      id: true,
      creditNoteNumber: true,
      totalPaise: true,
      reason: true,
      createdAt: true,
      invoice: {
        select: {
          invoiceNumber: true,
          customer: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const series = aggregateByBucket(
    notes.map((row) => ({
      at: row.createdAt,
      amountPaise: row.totalPaise,
    })),
    range,
  );

  const rows: ReportTableRow[] = notes.map((note) => ({
    id: note.id,
    label: note.creditNoteNumber,
    secondary: `${note.invoice.customer.name} · ${note.reason}`,
    date: note.createdAt,
    amountPaise: note.totalPaise,
  }));

  const totalPaise = notes.reduce((sum, row) => sum + row.totalPaise, 0);
  return { series, rows, totalPaise, count: notes.length };
}

export async function loadOutstandingReport(
  garageId: string,
  range: ReportRange,
) {
  const invoices = await prisma.invoice.findMany({
    where: {
      garageId,
      status: "FINALIZED",
      finalizedAt: { gte: range.from, lte: range.to },
    },
    select: {
      id: true,
      invoiceNumber: true,
      totalPaise: true,
      amountPaidPaise: true,
      finalizedAt: true,
      customer: { select: { id: true, name: true } },
      creditNotes: { select: { totalPaise: true } },
    },
    orderBy: { finalizedAt: "desc" },
  });

  const open = invoices
    .map((invoice) => {
      const creditNotesTotalPaise = sumCreditNotesPaise(invoice.creditNotes);
      const due = pendingBalancePaise({
        totalPaise: invoice.totalPaise,
        amountPaidPaise: invoice.amountPaidPaise,
        creditNotesTotalPaise,
      });
      return { invoice, due };
    })
    .filter((row) => row.due > 0);

  const byCustomer = new Map<
    string,
    { name: string; amountPaise: number }
  >();
  for (const row of open) {
    const id = row.invoice.customer.id;
    const existing = byCustomer.get(id);
    byCustomer.set(id, {
      name: row.invoice.customer.name,
      amountPaise: (existing?.amountPaise ?? 0) + row.due,
    });
  }

  const series: ReportSeriesPoint[] = [...byCustomer.entries()]
    .sort((a, b) => b[1].amountPaise - a[1].amountPaise)
    .slice(0, 12)
    .map(([customerId, entry]) => ({
      key: customerId,
      label: entry.name,
      amountPaise: entry.amountPaise,
      href: `/customers/${customerId}`,
    }));

  const rows: ReportTableRow[] = open.map(({ invoice, due }) => ({
    id: invoice.id,
    label: invoice.invoiceNumber ?? invoice.id,
    secondary: invoice.customer.name,
    date: invoice.finalizedAt ?? new Date(),
    amountPaise: due,
  }));

  const totalPaise = open.reduce((sum, row) => sum + row.due, 0);
  return { series, rows, totalPaise, count: open.length };
}

export type { ReportBucket };

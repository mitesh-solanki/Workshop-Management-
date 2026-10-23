import "server-only";

import type { Prisma } from "@prisma/client";
import {
  formatCreditNoteNumber,
  formatInvoiceNumber,
  financialYearStart,
  garageInvoiceCode,
} from "@/lib/financial-year";
import { prisma } from "@/lib/db";
import type { GstSplitKindValue } from "@/lib/gst";
import type {
  CreditNoteReasonValue,
  InvoiceLineTypeValue,
  PaymentMethodValue,
} from "@/modules/billing/schema";

export type DbClient = Prisma.TransactionClient | typeof prisma;

const invoiceInclude = {
  lines: { orderBy: { sortOrder: "asc" as const } },
  payments: { orderBy: { receivedAt: "asc" as const } },
  creditNotes: {
    orderBy: { createdAt: "asc" as const },
    include: { lines: { orderBy: { sortOrder: "asc" as const } } },
  },
  customer: {
    select: { id: true, name: true, phone: true, address: true },
  },
  serviceOrder: {
    select: {
      id: true,
      vehicle: {
        select: {
          registrationNumber: true,
          make: true,
          model: true,
        },
      },
    },
  },
  estimate: {
    select: { id: true, revisionNumber: true },
  },
} as const;

export type InvoiceWithDetails = Prisma.InvoiceGetPayload<{
  include: typeof invoiceInclude;
}>;

export async function findGarageBillingProfile(
  garageId: string,
  db: DbClient = prisma,
) {
  return db.garage.findFirst({
    where: { id: garageId },
    select: { id: true, name: true, address: true, gstin: true },
  });
}

export async function findInvoiceById(
  garageId: string,
  invoiceId: string,
  db: DbClient = prisma,
): Promise<InvoiceWithDetails | null> {
  return db.invoice.findFirst({
    where: { id: invoiceId, garageId },
    include: invoiceInclude,
  });
}

export async function listInvoicesForOrder(
  garageId: string,
  serviceOrderId: string,
) {
  return prisma.invoice.findMany({
    where: { garageId, serviceOrderId },
    include: invoiceInclude,
    orderBy: [{ createdAt: "desc" }],
  });
}

export type InvoiceLineCreateRow = {
  estimateLineId: string | null;
  type: InvoiceLineTypeValue;
  description: string;
  quantity: number;
  unitPricePaise: number;
  gstRatePercent: number;
  hsnOrSac: string;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
  sortOrder: number;
};

export async function createDraftInvoice(
  garageId: string,
  data: {
    serviceOrderId: string;
    estimateId: string;
    customerId: string;
    sellerStateCode: string;
    placeOfSupplyStateCode: string;
    gstSplit: GstSplitKindValue;
    taxablePaise: number;
    cgstPaise: number;
    sgstPaise: number;
    igstPaise: number;
    totalPaise: number;
    notes: string | null;
    createdById: string;
    lines: InvoiceLineCreateRow[];
  },
) {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.create({
      data: {
        garageId,
        serviceOrderId: data.serviceOrderId,
        estimateId: data.estimateId,
        customerId: data.customerId,
        status: "DRAFT",
        sellerStateCode: data.sellerStateCode,
        placeOfSupplyStateCode: data.placeOfSupplyStateCode,
        gstSplit: data.gstSplit,
        taxablePaise: data.taxablePaise,
        cgstPaise: data.cgstPaise,
        sgstPaise: data.sgstPaise,
        igstPaise: data.igstPaise,
        totalPaise: data.totalPaise,
        notes: data.notes,
        createdById: data.createdById,
        lines: {
          create: data.lines.map((line) => ({
            garageId,
            estimateLineId: line.estimateLineId,
            type: line.type,
            description: line.description,
            quantity: line.quantity,
            unitPricePaise: line.unitPricePaise,
            gstRatePercent: line.gstRatePercent,
            hsnOrSac: line.hsnOrSac,
            taxablePaise: line.taxablePaise,
            cgstPaise: line.cgstPaise,
            sgstPaise: line.sgstPaise,
            igstPaise: line.igstPaise,
            totalPaise: line.totalPaise,
            sortOrder: line.sortOrder,
          })),
        },
      },
      select: { id: true },
    });

    await tx.auditLog.create({
      data: {
        garageId,
        actorId: data.createdById,
        action: "billing.invoice_draft_created",
        entity: "Invoice",
        entityId: invoice.id,
        meta: {
          serviceOrderId: data.serviceOrderId,
          estimateId: data.estimateId,
          totalPaise: data.totalPaise,
          gstSplit: data.gstSplit,
        },
      },
    });

    return findInvoiceById(garageId, invoice.id, tx);
  });
}

/**
 * Allocate the next invoice number with a counter row lock (FOR UPDATE).
 * Must run inside an existing transaction when composing with other writes.
 */
async function loadGarageInvoiceCode(
  tx: Prisma.TransactionClient,
  garageId: string,
): Promise<string> {
  const garage = await tx.garage.findFirst({
    where: { id: garageId },
    select: { name: true },
  });
  return garageInvoiceCode(garage?.name ?? "");
}

export async function allocateInvoiceNumber(
  tx: Prisma.TransactionClient,
  garageId: string,
  at: Date = new Date(),
): Promise<{
  financialYearStart: number;
  sequenceNumber: number;
  invoiceNumber: string;
}> {
  const fyStart = financialYearStart(at);
  const garageCode = await loadGarageInvoiceCode(tx, garageId);

  await tx.$executeRaw`
    INSERT INTO "InvoiceNumberCounter" ("id", "garageId", "financialYearStart", "lastNumber")
    VALUES (${`inc_${garageId}_${fyStart}`}, ${garageId}, ${fyStart}, 0)
    ON CONFLICT ("garageId", "financialYearStart") DO NOTHING
  `;

  const locked = await tx.$queryRaw<
    Array<{ id: string; lastNumber: number }>
  >`
    SELECT id, "lastNumber" FROM "InvoiceNumberCounter"
    WHERE "garageId" = ${garageId} AND "financialYearStart" = ${fyStart}
    FOR UPDATE
  `;

  const row = locked[0];
  if (!row) {
    throw new Error("InvoiceNumberCounter lock failed");
  }

  const sequenceNumber = row.lastNumber + 1;
  await tx.invoiceNumberCounter.update({
    where: { id: row.id },
    data: { lastNumber: sequenceNumber },
  });

  return {
    financialYearStart: fyStart,
    sequenceNumber,
    invoiceNumber: formatInvoiceNumber(fyStart, sequenceNumber, garageCode),
  };
}

export async function allocateCreditNoteNumber(
  tx: Prisma.TransactionClient,
  garageId: string,
  at: Date = new Date(),
): Promise<{
  financialYearStart: number;
  sequenceNumber: number;
  creditNoteNumber: string;
}> {
  const fyStart = financialYearStart(at);
  const garageCode = await loadGarageInvoiceCode(tx, garageId);

  await tx.$executeRaw`
    INSERT INTO "CreditNoteNumberCounter" ("id", "garageId", "financialYearStart", "lastNumber")
    VALUES (${`cnc_${garageId}_${fyStart}`}, ${garageId}, ${fyStart}, 0)
    ON CONFLICT ("garageId", "financialYearStart") DO NOTHING
  `;

  const locked = await tx.$queryRaw<
    Array<{ id: string; lastNumber: number }>
  >`
    SELECT id, "lastNumber" FROM "CreditNoteNumberCounter"
    WHERE "garageId" = ${garageId} AND "financialYearStart" = ${fyStart}
    FOR UPDATE
  `;

  const row = locked[0];
  if (!row) {
    throw new Error("CreditNoteNumberCounter lock failed");
  }

  const sequenceNumber = row.lastNumber + 1;
  await tx.creditNoteNumberCounter.update({
    where: { id: row.id },
    data: { lastNumber: sequenceNumber },
  });

  return {
    financialYearStart: fyStart,
    sequenceNumber,
    creditNoteNumber: formatCreditNoteNumber(fyStart, sequenceNumber, garageCode),
  };
}

export async function finalizeInvoiceInTransaction(
  garageId: string,
  invoiceId: string,
  actorId: string,
  at: Date = new Date(),
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.invoice.findFirst({
      where: { id: invoiceId, garageId },
      select: { id: true, status: true },
    });
    if (!existing) {
      return null;
    }
    if (existing.status === "FINALIZED") {
      return { conflict: "already_finalized" as const };
    }

    const allocated = await allocateInvoiceNumber(tx, garageId, at);

    const updated = await tx.invoice.updateMany({
      where: { id: invoiceId, garageId, status: "DRAFT" },
      data: {
        status: "FINALIZED",
        invoiceNumber: allocated.invoiceNumber,
        financialYearStart: allocated.financialYearStart,
        sequenceNumber: allocated.sequenceNumber,
        finalizedAt: at,
      },
    });

    if (updated.count === 0) {
      return { conflict: "already_finalized" as const };
    }

    await tx.auditLog.create({
      data: {
        garageId,
        actorId,
        action: "billing.invoice_finalized",
        entity: "Invoice",
        entityId: invoiceId,
        meta: {
          invoiceNumber: allocated.invoiceNumber,
          financialYearStart: allocated.financialYearStart,
          sequenceNumber: allocated.sequenceNumber,
        },
      },
    });

    const invoice = await findInvoiceById(garageId, invoiceId, tx);
    return { invoice, allocated };
  });
}

/** Create draft and finalize in one transaction (single number allocation). */
export async function createAndFinalizeInvoice(
  garageId: string,
  data: {
    serviceOrderId: string;
    estimateId: string;
    customerId: string;
    sellerStateCode: string;
    placeOfSupplyStateCode: string;
    gstSplit: GstSplitKindValue;
    taxablePaise: number;
    cgstPaise: number;
    sgstPaise: number;
    igstPaise: number;
    totalPaise: number;
    notes: string | null;
    createdById: string;
    lines: InvoiceLineCreateRow[];
    at?: Date;
  },
) {
  const at = data.at ?? new Date();
  return prisma.$transaction(async (tx) => {
    const allocated = await allocateInvoiceNumber(tx, garageId, at);

    const created = await tx.invoice.create({
      data: {
        garageId,
        serviceOrderId: data.serviceOrderId,
        estimateId: data.estimateId,
        customerId: data.customerId,
        status: "FINALIZED",
        invoiceNumber: allocated.invoiceNumber,
        financialYearStart: allocated.financialYearStart,
        sequenceNumber: allocated.sequenceNumber,
        sellerStateCode: data.sellerStateCode,
        placeOfSupplyStateCode: data.placeOfSupplyStateCode,
        gstSplit: data.gstSplit,
        taxablePaise: data.taxablePaise,
        cgstPaise: data.cgstPaise,
        sgstPaise: data.sgstPaise,
        igstPaise: data.igstPaise,
        totalPaise: data.totalPaise,
        notes: data.notes,
        finalizedAt: at,
        createdById: data.createdById,
        lines: {
          create: data.lines.map((line) => ({
            garageId,
            estimateLineId: line.estimateLineId,
            type: line.type,
            description: line.description,
            quantity: line.quantity,
            unitPricePaise: line.unitPricePaise,
            gstRatePercent: line.gstRatePercent,
            hsnOrSac: line.hsnOrSac,
            taxablePaise: line.taxablePaise,
            cgstPaise: line.cgstPaise,
            sgstPaise: line.sgstPaise,
            igstPaise: line.igstPaise,
            totalPaise: line.totalPaise,
            sortOrder: line.sortOrder,
          })),
        },
      },
      select: { id: true },
    });

    await tx.auditLog.create({
      data: {
        garageId,
        actorId: data.createdById,
        action: "billing.invoice_finalized",
        entity: "Invoice",
        entityId: created.id,
        meta: {
          invoiceNumber: allocated.invoiceNumber,
          serviceOrderId: data.serviceOrderId,
          estimateId: data.estimateId,
          totalPaise: data.totalPaise,
          gstSplit: data.gstSplit,
        },
      },
    });

    return findInvoiceById(garageId, created.id, tx);
  });
}

export async function recordPaymentRow(
  garageId: string,
  data: {
    invoiceId: string;
    method: PaymentMethodValue;
    amountPaise: number;
    cashPaise: number;
    upiPaise: number;
    cardPaise: number;
    note: string | null;
    actorId: string;
    receivedAt?: Date;
  },
) {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: { id: data.invoiceId, garageId },
      select: {
        id: true,
        status: true,
        totalPaise: true,
        amountPaidPaise: true,
        creditNotes: { select: { totalPaise: true } },
      },
    });
    if (!invoice) {
      return null;
    }
    if (invoice.status !== "FINALIZED") {
      return { error: "not_finalized" as const };
    }

    const creditTotal = invoice.creditNotes.reduce(
      (sum, note) => sum + note.totalPaise,
      0,
    );
    const pending =
      invoice.totalPaise - creditTotal - invoice.amountPaidPaise;
    if (data.amountPaise > pending) {
      return { error: "overpay" as const, pending };
    }

    const payment = await tx.payment.create({
      data: {
        garageId,
        invoiceId: data.invoiceId,
        method: data.method,
        amountPaise: data.amountPaise,
        isRefund: false,
        cashPaise: data.cashPaise,
        upiPaise: data.upiPaise,
        cardPaise: data.cardPaise,
        note: data.note,
        receivedAt: data.receivedAt ?? new Date(),
        createdById: data.actorId,
      },
    });

    const paid = await tx.invoice.updateMany({
      where: { id: data.invoiceId, garageId },
      data: {
        amountPaidPaise: invoice.amountPaidPaise + data.amountPaise,
      },
    });
    if (paid.count === 0) {
      return null;
    }

    await tx.auditLog.create({
      data: {
        garageId,
        actorId: data.actorId,
        action: "billing.payment_recorded",
        entity: "Payment",
        entityId: payment.id,
        meta: {
          invoiceId: data.invoiceId,
          method: data.method,
          amountPaise: data.amountPaise,
        },
      },
    });

    const updated = await findInvoiceById(garageId, data.invoiceId, tx);
    return { payment, invoice: updated };
  });
}

export async function recordRefundRow(
  garageId: string,
  data: {
    invoiceId: string;
    method: PaymentMethodValue;
    amountPaise: number;
    cashPaise: number;
    upiPaise: number;
    cardPaise: number;
    note: string | null;
    actorId: string;
    receivedAt?: Date;
  },
) {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: { id: data.invoiceId, garageId },
      select: {
        id: true,
        status: true,
        totalPaise: true,
        amountPaidPaise: true,
        creditNotes: { select: { totalPaise: true } },
      },
    });
    if (!invoice) {
      return null;
    }
    if (invoice.status !== "FINALIZED") {
      return { error: "not_finalized" as const };
    }

    const creditTotal = invoice.creditNotes.reduce(
      (sum, note) => sum + note.totalPaise,
      0,
    );
    const netBill = Math.max(0, invoice.totalPaise - creditTotal);
    const refundDue = Math.max(0, invoice.amountPaidPaise - netBill);
    if (data.amountPaise > refundDue) {
      return { error: "over_refund" as const, refundDue };
    }

    const payment = await tx.payment.create({
      data: {
        garageId,
        invoiceId: data.invoiceId,
        method: data.method,
        amountPaise: data.amountPaise,
        isRefund: true,
        cashPaise: data.cashPaise,
        upiPaise: data.upiPaise,
        cardPaise: data.cardPaise,
        note: data.note,
        receivedAt: data.receivedAt ?? new Date(),
        createdById: data.actorId,
      },
    });

    const updatedPaid = await tx.invoice.updateMany({
      where: { id: data.invoiceId, garageId },
      data: {
        amountPaidPaise: invoice.amountPaidPaise - data.amountPaise,
      },
    });
    if (updatedPaid.count === 0) {
      return null;
    }

    await tx.auditLog.create({
      data: {
        garageId,
        actorId: data.actorId,
        action: "billing.refund_recorded",
        entity: "Payment",
        entityId: payment.id,
        meta: {
          invoiceId: data.invoiceId,
          method: data.method,
          amountPaise: data.amountPaise,
        },
      },
    });

    const updated = await findInvoiceById(garageId, data.invoiceId, tx);
    return { payment, invoice: updated };
  });
}

export type CreditNoteLineCreateRow = {
  description: string;
  quantity: number;
  unitPricePaise: number;
  gstRatePercent: number;
  hsnOrSac: string;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
  sortOrder: number;
};

export async function createCreditNoteRow(
  garageId: string,
  data: {
    invoiceId: string;
    reason: CreditNoteReasonValue;
    notes: string | null;
    actorId: string;
    taxablePaise: number;
    cgstPaise: number;
    sgstPaise: number;
    igstPaise: number;
    totalPaise: number;
    lines: CreditNoteLineCreateRow[];
    at?: Date;
  },
) {
  const at = data.at ?? new Date();
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: { id: data.invoiceId, garageId },
      select: {
        id: true,
        status: true,
        totalPaise: true,
        amountPaidPaise: true,
        gstSplit: true,
        creditNotes: { select: { totalPaise: true } },
      },
    });
    if (!invoice) {
      return null;
    }
    if (invoice.status !== "FINALIZED") {
      return { error: "not_finalized" as const };
    }

    const existingCredits = invoice.creditNotes.reduce(
      (sum, note) => sum + note.totalPaise,
      0,
    );
    if (existingCredits + data.totalPaise > invoice.totalPaise) {
      return { error: "exceeds_invoice" as const };
    }

    const allocated = await allocateCreditNoteNumber(tx, garageId, at);

    const note = await tx.creditNote.create({
      data: {
        garageId,
        invoiceId: data.invoiceId,
        creditNoteNumber: allocated.creditNoteNumber,
        financialYearStart: allocated.financialYearStart,
        sequenceNumber: allocated.sequenceNumber,
        reason: data.reason,
        taxablePaise: data.taxablePaise,
        cgstPaise: data.cgstPaise,
        sgstPaise: data.sgstPaise,
        igstPaise: data.igstPaise,
        totalPaise: data.totalPaise,
        notes: data.notes,
        createdById: data.actorId,
        lines: {
          create: data.lines.map((line) => ({
            garageId,
            description: line.description,
            quantity: line.quantity,
            unitPricePaise: line.unitPricePaise,
            gstRatePercent: line.gstRatePercent,
            hsnOrSac: line.hsnOrSac,
            taxablePaise: line.taxablePaise,
            cgstPaise: line.cgstPaise,
            sgstPaise: line.sgstPaise,
            igstPaise: line.igstPaise,
            totalPaise: line.totalPaise,
            sortOrder: line.sortOrder,
          })),
        },
      },
      include: { lines: true },
    });

    await tx.auditLog.create({
      data: {
        garageId,
        actorId: data.actorId,
        action: "billing.credit_note_created",
        entity: "CreditNote",
        entityId: note.id,
        meta: {
          invoiceId: data.invoiceId,
          creditNoteNumber: allocated.creditNoteNumber,
          reason: data.reason,
          totalPaise: data.totalPaise,
        },
      },
    });

    const updatedInvoice = await findInvoiceById(garageId, data.invoiceId, tx);
    return { creditNote: note, invoice: updatedInvoice };
  });
}

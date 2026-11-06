import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  pendingBalancePaise,
  sumCreditNotesPaise,
} from "@/modules/billing/balance";
import {
  invoicePaymentStatus,
  type InvoicePaymentStatus,
} from "@/modules/invoices/payment-status";

const invoiceListSelect = {
  id: true,
  serviceOrderId: true,
  status: true,
  invoiceNumber: true,
  totalPaise: true,
  amountPaidPaise: true,
  finalizedAt: true,
  createdAt: true,
  customer: {
    select: { id: true, name: true, phone: true },
  },
  serviceOrder: {
    select: {
      id: true,
      jobCardNumber: true,
      vehicle: {
        select: {
          registrationNumber: true,
          make: true,
          model: true,
        },
      },
    },
  },
  creditNotes: {
    select: { totalPaise: true },
  },
  _count: {
    select: { payments: true, creditNotes: true },
  },
} as const;

export type InvoiceListRow = Prisma.InvoiceGetPayload<{
  select: typeof invoiceListSelect;
}>;

const PAYMENT_FILTER_CAP = 5_000;

function invoiceSearchWhere(
  garageId: string,
  q: string | undefined,
): Prisma.InvoiceWhereInput {
  const query = q?.trim();
  const registrationQuery = query
    ? query.replace(/\s+/g, "").toUpperCase()
    : undefined;
  const jobCardFromQuery = (() => {
    if (!query) return null;
    if (/^\d+$/.test(query)) {
      const n = Number(query);
      return Number.isSafeInteger(n) && n > 0 ? n : null;
    }
    const fromLabel = query.match(/INV-\d{4}-\d{2}-(\d+)$/i)?.[1];
    if (!fromLabel) return null;
    const n = Number(fromLabel);
    return Number.isSafeInteger(n) && n > 0 ? n : null;
  })();

  return {
    garageId,
    ...(query
      ? {
          OR: [
            {
              invoiceNumber: {
                contains: query,
                mode: "insensitive",
              },
            },
            ...(jobCardFromQuery != null
              ? [
                  {
                    serviceOrder: {
                      jobCardNumber: jobCardFromQuery,
                    },
                  },
                ]
              : []),
            {
              customer: {
                name: { contains: query, mode: "insensitive" },
              },
            },
            {
              customer: {
                phone: { contains: query },
              },
            },
            {
              serviceOrder: {
                vehicle: {
                  registrationNumber: {
                    contains: registrationQuery,
                    mode: "insensitive",
                  },
                },
              },
            },
          ],
        }
      : {}),
  };
}

function rowPaymentStatus(invoice: InvoiceListRow): InvoicePaymentStatus {
  const creditNotesTotalPaise = sumCreditNotesPaise(invoice.creditNotes);
  return invoicePaymentStatus({
    status: invoice.status,
    pendingBalancePaise: pendingBalancePaise({
      totalPaise: invoice.totalPaise,
      amountPaidPaise: invoice.amountPaidPaise,
      creditNotesTotalPaise,
    }),
    amountPaidPaise: invoice.amountPaidPaise,
    finalizedAt: invoice.finalizedAt,
  });
}

export async function searchInvoices(
  garageId: string,
  q: string | undefined,
  paymentStatus: InvoicePaymentStatus | undefined,
  sort: string,
  page: number,
  pageSize: number,
) {
  const baseWhere = invoiceSearchWhere(garageId, q);
  const skip = (page - 1) * pageSize;
  const createdDir = sort === "oldest" ? "asc" : "desc";
  const orderBy = [{ createdAt: createdDir }] as const;

  if (!paymentStatus) {
    const where = baseWhere;
    const [items, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        select: invoiceListSelect,
        orderBy: [...orderBy],
        skip,
        take: pageSize,
      }),
      prisma.invoice.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  if (paymentStatus === "DRAFT") {
    const where: Prisma.InvoiceWhereInput = {
      ...baseWhere,
      status: "DRAFT",
    };
    const [items, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        select: invoiceListSelect,
        orderBy: [...orderBy],
        skip,
        take: pageSize,
      }),
      prisma.invoice.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  const candidates = await prisma.invoice.findMany({
    where: { ...baseWhere, status: "FINALIZED" },
    select: invoiceListSelect,
    orderBy: [...orderBy],
    take: PAYMENT_FILTER_CAP,
  });

  const matched = candidates.filter(
    (invoice) => rowPaymentStatus(invoice) === paymentStatus,
  );
  const total = matched.length;
  const items = matched.slice(skip, skip + pageSize);

  return { items, total, page, pageSize };
}

const GST_EXPORT_CAP = 2_000;

const gstExportSelect = {
  id: true,
  invoiceNumber: true,
  finalizedAt: true,
  taxablePaise: true,
  cgstPaise: true,
  sgstPaise: true,
  igstPaise: true,
  totalPaise: true,
  customer: {
    select: { name: true, gstin: true },
  },
  serviceOrder: {
    select: { jobCardNumber: true },
  },
} as const;

export type GstExportInvoiceDbRow = Prisma.InvoiceGetPayload<{
  select: typeof gstExportSelect;
}>;

/** Finalized invoices in [from, toExclusive) by finalizedAt, garage-scoped. */
export async function listFinalizedInvoicesForGstExport(
  garageId: string,
  from: Date,
  toExclusive: Date,
) {
  return prisma.invoice.findMany({
    where: {
      garageId,
      status: "FINALIZED",
      finalizedAt: { gte: from, lt: toExclusive },
    },
    select: gstExportSelect,
    orderBy: { finalizedAt: "asc" },
    take: GST_EXPORT_CAP,
  });
}

export async function listFinalizedInvoicesForGstExportByIds(
  garageId: string,
  from: Date,
  toExclusive: Date,
  invoiceIds: string[],
) {
  if (invoiceIds.length === 0) return [];
  return prisma.invoice.findMany({
    where: {
      garageId,
      status: "FINALIZED",
      id: { in: invoiceIds },
      finalizedAt: { gte: from, lt: toExclusive },
    },
    select: gstExportSelect,
    orderBy: { finalizedAt: "asc" },
    take: GST_EXPORT_CAP,
  });
}

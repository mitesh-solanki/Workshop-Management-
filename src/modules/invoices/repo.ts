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

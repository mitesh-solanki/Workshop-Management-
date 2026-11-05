import "server-only";

import { prisma } from "@/lib/db";
import { toPaise } from "@/lib/money";

export async function findGarageNameForSummary(garageId: string) {
  return prisma.garage.findFirst({
    where: { id: garageId },
    select: { id: true, name: true },
  });
}

export async function listJobCardsCreatedOnDay(
  garageId: string,
  start: Date,
  end: Date,
) {
  return prisma.serviceOrder.findMany({
    where: {
      garageId,
      createdAt: { gte: start, lt: end },
    },
    select: {
      id: true,
      jobCardNumber: true,
      status: true,
      createdAt: true,
      customer: { select: { id: true, name: true } },
      vehicle: {
        select: {
          id: true,
          registrationNumber: true,
          make: true,
          model: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function listInspectionsCreatedOnDay(
  garageId: string,
  start: Date,
  end: Date,
) {
  return prisma.inspection.findMany({
    where: {
      garageId,
      createdAt: { gte: start, lt: end },
    },
    select: {
      id: true,
      createdAt: true,
      customer: { select: { id: true, name: true } },
      vehicle: {
        select: {
          id: true,
          registrationNumber: true,
          make: true,
          model: true,
        },
      },
      serviceOrderId: true,
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function countJobsCompletedOnDay(
  garageId: string,
  start: Date,
  end: Date,
) {
  return prisma.serviceOrder.count({
    where: {
      garageId,
      status: "COMPLETED",
      updatedAt: { gte: start, lt: end },
    },
  });
}

export async function countOpenJobsNow(garageId: string) {
  return prisma.serviceOrder.count({
    where: {
      garageId,
      status: { not: "COMPLETED" },
    },
  });
}

export async function listInvoicesFinalizedOnDay(
  garageId: string,
  start: Date,
  end: Date,
) {
  return prisma.invoice.findMany({
    where: {
      garageId,
      status: "FINALIZED",
      finalizedAt: { gte: start, lt: end },
    },
    select: {
      id: true,
      invoiceNumber: true,
      totalPaise: true,
      amountPaidPaise: true,
      finalizedAt: true,
      serviceOrderId: true,
      customer: { select: { id: true, name: true } },
      serviceOrder: {
        select: {
          jobCardNumber: true,
          vehicle: {
            select: { registrationNumber: true },
          },
        },
      },
      creditNotes: { select: { totalPaise: true } },
    },
    orderBy: { finalizedAt: "asc" },
  });
}

export async function listPaymentsReceivedOnDay(
  garageId: string,
  start: Date,
  end: Date,
) {
  return prisma.payment.findMany({
    where: {
      garageId,
      status: "PAID",
      receivedAt: { gte: start, lt: end },
    },
    select: {
      id: true,
      method: true,
      amountPaise: true,
      isRefund: true,
      cashPaise: true,
      upiPaise: true,
      cardPaise: true,
      receivedAt: true,
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          serviceOrderId: true,
          customer: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { receivedAt: "asc" },
  });
}

export async function listExpensesOnDay(
  garageId: string,
  start: Date,
  end: Date,
) {
  return prisma.expense.findMany({
    where: {
      garageId,
      spentAt: { gte: start, lt: end },
    },
    select: {
      id: true,
      amountPaise: true,
      spentAt: true,
      status: true,
      method: true,
      category: true,
      note: true,
    },
    orderBy: { spentAt: "asc" },
  });
}

export async function listOpenDuesInvoices(garageId: string) {
  const rows = await prisma.invoice.findMany({
    where: {
      garageId,
      status: "FINALIZED",
    },
    select: {
      id: true,
      invoiceNumber: true,
      serviceOrderId: true,
      totalPaise: true,
      amountPaidPaise: true,
      customer: { select: { name: true } },
      creditNotes: { select: { totalPaise: true } },
    },
  });

  return rows
    .map((row) => {
      const creditTotal = row.creditNotes.reduce(
        (sum, note) => sum + toPaise(note.totalPaise),
        0,
      );
      const pending = Math.max(
        0,
        toPaise(row.totalPaise) - creditTotal - toPaise(row.amountPaidPaise),
      );
      return {
        id: row.id,
        invoiceNumber: row.invoiceNumber,
        serviceOrderId: row.serviceOrderId,
        customerName: row.customer.name,
        totalPaise: toPaise(row.totalPaise),
        amountPaidPaise: toPaise(row.amountPaidPaise),
        pendingPaise: pending,
      };
    })
    .filter((row) => row.pendingPaise > 0)
    .sort((a, b) => b.pendingPaise - a.pendingPaise);
}

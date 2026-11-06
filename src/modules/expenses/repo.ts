import "server-only";

import type { ExpenseStatus, PaymentMethod, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type {
  ExpenseSort,
  ExpenseStatusFilter,
} from "@/modules/expenses/schema";

const expenseSelect = {
  id: true,
  amountPaise: true,
  spentAt: true,
  status: true,
  method: true,
  category: true,
  note: true,
  vendorId: true,
  gstSplit: true,
  gstRatePercent: true,
  billStorageKey: true,
  billContentType: true,
  billFileName: true,
  billByteSize: true,
  createdAt: true,
  updatedAt: true,
  vendor: {
    select: { id: true, name: true, gstin: true },
  },
} as const;

function expenseOrderBy(
  sort: ExpenseSort,
): Prisma.ExpenseOrderByWithRelationInput {
  switch (sort) {
    case "oldest":
      return { spentAt: "asc" };
    case "amount_desc":
      return { amountPaise: "desc" };
    case "amount_asc":
      return { amountPaise: "asc" };
    case "newest":
    default:
      return { spentAt: "desc" };
  }
}

export async function searchExpenses(
  garageId: string,
  q: string | undefined,
  category: string | undefined,
  status: ExpenseStatusFilter,
  page: number,
  pageSize: number,
  sort: ExpenseSort,
) {
  const where: Prisma.ExpenseWhereInput = {
    garageId,
    ...(status !== "ALL" ? { status } : {}),
    ...(category
      ? { category: { equals: category, mode: "insensitive" } }
      : {}),
    ...(q
      ? {
        OR: [
          { note: { contains: q, mode: "insensitive" } },
          { category: { contains: q, mode: "insensitive" } },
          { vendor: { name: { contains: q, mode: "insensitive" } } },
          { vendor: { gstin: { contains: q, mode: "insensitive" } } },
        ],
      }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.expense.count({ where }),
    prisma.expense.findMany({
      where,
      orderBy: [expenseOrderBy(sort), { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: expenseSelect,
    }),
  ]);

  return { items, total, page, pageSize };
}

export async function listUsedExpenseCategories(garageId: string) {
  const rows = await prisma.expense.findMany({
    where: { garageId },
    distinct: ["category"],
    orderBy: { category: "asc" },
    select: { category: true },
    take: 100,
  });
  return rows.map((row) => row.category).filter(Boolean);
}

export async function findExpenseById(garageId: string, expenseId: string) {
  return prisma.expense.findFirst({
    where: { id: expenseId, garageId },
    select: expenseSelect,
  });
}

export async function createExpense(
  garageId: string,
  input: {
    amountPaise: number;
    spentAt: Date;
    status: ExpenseStatus;
    method: PaymentMethod | null;
    category: string;
    note: string | null;
    vendorId: string | null;
    gstSplit: "CGST_SGST" | "IGST";
    gstRatePercent: number;
    recordedById: string;
  },
) {
  return prisma.expense.create({
    data: {
      garageId,
      amountPaise: input.amountPaise,
      spentAt: input.spentAt,
      status: input.status,
      method: input.method,
      category: input.category,
      note: input.note,
      vendorId: input.vendorId,
      gstSplit: input.gstSplit,
      gstRatePercent: input.gstRatePercent,
      recordedById: input.recordedById,
    },
    select: expenseSelect,
  });
}

export async function updateExpenseById(
  garageId: string,
  expenseId: string,
  input: {
    amountPaise: number;
    spentAt: Date;
    status: ExpenseStatus;
    method: PaymentMethod | null;
    category: string;
    note: string | null;
    vendorId: string | null;
    gstSplit: "CGST_SGST" | "IGST";
    gstRatePercent: number;
    clearBill?: boolean;
  },
) {
  const existing = await findExpenseById(garageId, expenseId);
  if (!existing) return null;

  return prisma.expense.update({
    where: { id: expenseId },
    data: {
      amountPaise: input.amountPaise,
      spentAt: input.spentAt,
      status: input.status,
      method: input.method,
      category: input.category,
      note: input.note,
      vendorId: input.vendorId,
      gstSplit: input.gstSplit,
      gstRatePercent: input.gstRatePercent,
      ...(input.clearBill
        ? {
          billStorageKey: null,
          billContentType: null,
          billFileName: null,
          billByteSize: null,
        }
        : {}),
    },
    select: expenseSelect,
  });
}

export async function setExpenseBill(
  garageId: string,
  input: {
    expenseId: string;
    storageKey: string;
    contentType: string;
    fileName: string | null;
    byteSize: number;
    actorId: string;
  },
) {
  const existing = await findExpenseById(garageId, input.expenseId);
  if (!existing) return null;

  const previousStorageKey = existing.billStorageKey;
  const expense = await prisma.expense.update({
    where: { id: input.expenseId },
    data: {
      billStorageKey: input.storageKey,
      billContentType: input.contentType,
      billFileName: input.fileName,
      billByteSize: input.byteSize,
    },
    select: expenseSelect,
  });

  await prisma.auditLog.create({
    data: {
      garageId,
      actorId: input.actorId,
      action: "expense.bill_uploaded",
      entity: "Expense",
      entityId: expense.id,
      meta: {
        billFileName: input.fileName,
        billByteSize: input.byteSize,
        billContentType: input.contentType,
      },
    },
  });

  return { expense, previousStorageKey };
}

export async function markExpensePaidById(
  garageId: string,
  expenseId: string,
  input: {
    method: PaymentMethod;
    spentAt?: Date;
  },
) {
  const existing = await findExpenseById(garageId, expenseId);
  if (!existing) return null;

  return prisma.expense.update({
    where: { id: expenseId },
    data: {
      status: "PAID",
      method: input.method,
      ...(input.spentAt ? { spentAt: input.spentAt } : {}),
    },
    select: expenseSelect,
  });
}

export async function deleteExpenseById(garageId: string, expenseId: string) {
  const existing = await findExpenseById(garageId, expenseId);
  if (!existing) return null;

  await prisma.expense.delete({ where: { id: expenseId } });
  return existing;
}

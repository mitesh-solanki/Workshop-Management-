import "server-only";

import { writeAuditLog } from "@/lib/audit";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { requireRole, type RoleSession } from "@/lib/rbac";
import {
  createExpense,
  deleteExpenseById,
  findExpenseById,
  listUsedExpenseCategories,
  markExpensePaidById,
  searchExpenses,
  updateExpenseById,
} from "@/modules/expenses/repo";
import {
  createExpenseSchema,
  deleteExpenseSchema,
  expenseSearchSchema,
  markExpensePaidSchema,
  updateExpenseSchema,
  type CreateExpenseInput,
  type MarkExpensePaidInput,
  type UpdateExpenseInput,
} from "@/modules/expenses/schema";

const ACCESS_ROLES = ["OWNER", "MANAGER", "ACCOUNTANT"] as const;
const WRITE_ROLES = ["OWNER", "MANAGER", "ACCOUNTANT"] as const;

function parseDateOnly(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toDateInput(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function assertWrite(session: RoleSession) {
  assertCanAccessExpenses(session);
  if (!canWriteExpenses(session)) {
    throw new ForbiddenError();
  }
}

export function assertCanAccessExpenses(session: RoleSession) {
  requireRole(session, ACCESS_ROLES);
}

export function canWriteExpenses(session: RoleSession) {
  return WRITE_ROLES.includes(session.role as (typeof WRITE_ROLES)[number]);
}

export async function listExpenses(
  session: RoleSession,
  raw: {
    q?: string;
    category?: string;
    status?: string;
    sort?: string;
    page?: number | string;
    pageSize?: number | string;
  } = {},
) {
  assertCanAccessExpenses(session);
  const input = expenseSearchSchema.parse(raw);
  return searchExpenses(
    session.garageId,
    input.q,
    input.category,
    input.status,
    input.page,
    input.pageSize,
    input.sort,
  );
}

export async function listExpenseCategoryOptions(session: RoleSession) {
  assertCanAccessExpenses(session);
  return listUsedExpenseCategories(session.garageId);
}

export async function getExpense(session: RoleSession, expenseId: string) {
  assertCanAccessExpenses(session);
  const expense = await findExpenseById(session.garageId, expenseId);
  if (!expense) {
    throw new NotFoundError();
  }
  return {
    ...expense,
    spentAtInput: toDateInput(expense.spentAt),
  };
}

export async function createExpenseRecord(
  session: RoleSession,
  raw: CreateExpenseInput,
) {
  assertWrite(session);
  const input = createExpenseSchema.parse(raw);
  const method = input.status === "PAID" ? input.method : null;
  const expense = await createExpense(session.garageId, {
    amountPaise: input.amountRupees,
    spentAt: parseDateOnly(input.spentAt),
    status: input.status,
    method,
    category: input.category,
    note: input.note,
    recordedById: session.userId,
  });

  await writeAuditLog({
    garageId: session.garageId,
    actorId: session.userId,
    action: "expense.created",
    entity: "Expense",
    entityId: expense.id,
    meta: {
      amountPaise: expense.amountPaise,
      status: expense.status,
      method: expense.method,
      category: expense.category,
      spentAt: expense.spentAt.toISOString(),
    },
  });

  return expense;
}

export async function updateExpenseRecord(
  session: RoleSession,
  expenseId: string,
  raw: UpdateExpenseInput,
) {
  assertWrite(session);
  const input = updateExpenseSchema.parse(raw);
  const method = input.status === "PAID" ? input.method : null;
  const expense = await updateExpenseById(session.garageId, expenseId, {
    amountPaise: input.amountRupees,
    spentAt: parseDateOnly(input.spentAt),
    status: input.status,
    method,
    category: input.category,
    note: input.note,
  });
  if (!expense) {
    throw new NotFoundError();
  }

  await writeAuditLog({
    garageId: session.garageId,
    actorId: session.userId,
    action: "expense.updated",
    entity: "Expense",
    entityId: expense.id,
    meta: {
      amountPaise: expense.amountPaise,
      status: expense.status,
      method: expense.method,
      category: expense.category,
      spentAt: expense.spentAt.toISOString(),
    },
  });

  return expense;
}

export async function markExpensePaidRecord(
  session: RoleSession,
  raw: MarkExpensePaidInput,
) {
  assertWrite(session);
  const input = markExpensePaidSchema.parse(raw);
  const existing = await findExpenseById(session.garageId, input.expenseId);
  if (!existing) {
    throw new NotFoundError();
  }
  if (existing.status === "PAID") {
    throw new AppError("expenses.already_paid", 409);
  }

  const expense = await markExpensePaidById(session.garageId, input.expenseId, {
    method: input.method,
    spentAt: input.spentAt ? parseDateOnly(input.spentAt) : undefined,
  });
  if (!expense) {
    throw new NotFoundError();
  }

  await writeAuditLog({
    garageId: session.garageId,
    actorId: session.userId,
    action: "expense.marked_paid",
    entity: "Expense",
    entityId: expense.id,
    meta: {
      amountPaise: expense.amountPaise,
      method: expense.method,
      spentAt: expense.spentAt.toISOString(),
    },
  });

  return expense;
}

export async function deleteExpenseRecord(
  session: RoleSession,
  expenseId: string,
) {
  assertWrite(session);
  const parsed = deleteExpenseSchema.parse({ expenseId });
  const expense = await deleteExpenseById(session.garageId, parsed.expenseId);
  if (!expense) {
    throw new NotFoundError();
  }

  await writeAuditLog({
    garageId: session.garageId,
    actorId: session.userId,
    action: "expense.deleted",
    entity: "Expense",
    entityId: expense.id,
    meta: {
      amountPaise: expense.amountPaise,
      status: expense.status,
      method: expense.method,
      category: expense.category,
      spentAt: expense.spentAt.toISOString(),
    },
  });

  return expense;
}

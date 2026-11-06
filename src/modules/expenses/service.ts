import "server-only";

import { writeAuditLog } from "@/lib/audit";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { requireRole, type RoleSession } from "@/lib/rbac";
import {
  buildExpenseBillKey,
  createPresignedDownloadUrl,
  createPresignedUploadUrl,
  deleteStoredObject,
  storageKeyBelongsToGarage,
} from "@/lib/storage";
import {
  createExpense,
  deleteExpenseById,
  findExpenseById,
  listUsedExpenseCategories,
  markExpensePaidById,
  searchExpenses,
  setExpenseBill,
  updateExpenseById,
} from "@/modules/expenses/repo";
import {
  assertExpenseBillLimits,
  confirmExpenseBillSchema,
  createExpenseBillUploadUrlSchema,
  createExpenseSchema,
  deleteExpenseSchema,
  expenseSearchSchema,
  markExpensePaidSchema,
  updateExpenseSchema,
  type ConfirmExpenseBillInput,
  type CreateExpenseBillUploadUrlInput,
  type CreateExpenseInput,
  type MarkExpensePaidInput,
  type UpdateExpenseInput,
} from "@/modules/expenses/schema";
import { findVendorById } from "@/modules/vendors/repo";
import { getVendorOptions } from "@/modules/vendors/service";

const ACCESS_ROLES = ["OWNER", "MANAGER", "ACCOUNTANT"] as const;
const WRITE_ROLES = ["OWNER", "MANAGER", "ACCOUNTANT"] as const;

async function resolveExpenseVendorId(
  session: RoleSession,
  vendorId: string | null,
) {
  if (!vendorId) return null;
  const vendor = await findVendorById(session.garageId, vendorId);
  if (!vendor) {
    throw new AppError("validation.invalidInput", 400);
  }
  return vendor.id;
}

export async function listExpenseVendorOptions(session: RoleSession) {
  assertCanAccessExpenses(session);
  return getVendorOptions(session);
}

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
  const vendorId = await resolveExpenseVendorId(session, input.vendorId);
  const expense = await createExpense(session.garageId, {
    amountPaise: input.amountRupees,
    spentAt: parseDateOnly(input.spentAt),
    status: input.status,
    method,
    category: input.category,
    note: input.note,
    vendorId,
    gstSplit: input.gstSplit,
    gstRatePercent: input.gstRatePercent,
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
      vendorId: expense.vendorId,
      gstSplit: expense.gstSplit,
      gstRatePercent: expense.gstRatePercent,
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
  const existing = await findExpenseById(session.garageId, expenseId);
  if (!existing) {
    throw new NotFoundError();
  }
  const vendorId = await resolveExpenseVendorId(session, input.vendorId);
  const clearBill =
    input.gstRatePercent === 0 && Boolean(existing.billStorageKey);
  const previousBillKey = clearBill ? existing.billStorageKey : null;
  const expense = await updateExpenseById(session.garageId, expenseId, {
    amountPaise: input.amountRupees,
    spentAt: parseDateOnly(input.spentAt),
    status: input.status,
    method,
    category: input.category,
    note: input.note,
    vendorId,
    gstSplit: input.gstSplit,
    gstRatePercent: input.gstRatePercent,
    clearBill,
  });
  if (!expense) {
    throw new NotFoundError();
  }

  if (previousBillKey) {
    try {
      await deleteStoredObject(previousBillKey);
    } catch { }
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
      vendorId: expense.vendorId,
      gstSplit: expense.gstSplit,
      gstRatePercent: expense.gstRatePercent,
      spentAt: expense.spentAt.toISOString(),
    },
  });

  return expense;
}

export async function createExpenseBillUploadUrl(
  session: RoleSession,
  raw: CreateExpenseBillUploadUrlInput,
) {
  assertWrite(session);
  const input = createExpenseBillUploadUrlSchema.parse(raw);
  try {
    assertExpenseBillLimits(input.contentType, input.byteSize);
  } catch (error) {
    const code =
      error instanceof Error ? error.message : "expenses.bill_type";
    throw new AppError(code, 400);
  }

  const expense = await findExpenseById(session.garageId, input.expenseId);
  if (!expense) throw new NotFoundError();
  if (expense.gstRatePercent <= 0) {
    throw new AppError("expenses.bill_not_needed", 400);
  }

  const storageKey = buildExpenseBillKey({
    garageId: session.garageId,
    expenseId: expense.id,
    contentType: input.contentType,
  });

  try {
    const signed = await createPresignedUploadUrl({
      storageKey,
      contentType: input.contentType,
    });
    return {
      uploadUrl: signed.uploadUrl,
      storageKey: signed.storageKey,
      method: signed.method,
      fields: signed.fields,
      contentType: input.contentType,
      expenseId: expense.id,
    };
  } catch (error) {
    if (error instanceof AppError && error.code === "STORAGE_NOT_CONFIGURED") {
      throw new AppError("STORAGE_NOT_CONFIGURED", 500);
    }
    throw error;
  }
}

export async function confirmExpenseBill(
  session: RoleSession,
  raw: ConfirmExpenseBillInput,
) {
  assertWrite(session);
  const input = confirmExpenseBillSchema.parse(raw);
  try {
    assertExpenseBillLimits(input.contentType, input.byteSize);
  } catch (error) {
    const code =
      error instanceof Error ? error.message : "expenses.bill_type";
    throw new AppError(code, 400);
  }

  if (!storageKeyBelongsToGarage(input.storageKey, session.garageId)) {
    throw new ForbiddenError();
  }
  if (!input.storageKey.includes(`/expenses/${input.expenseId}/`)) {
    throw new ForbiddenError();
  }

  const expense = await findExpenseById(session.garageId, input.expenseId);
  if (!expense) throw new NotFoundError();
  if (expense.gstRatePercent <= 0) {
    throw new AppError("expenses.bill_not_needed", 400);
  }

  const result = await setExpenseBill(session.garageId, {
    expenseId: input.expenseId,
    storageKey: input.storageKey,
    contentType: input.contentType,
    fileName: input.fileName,
    byteSize: input.byteSize,
    actorId: session.userId,
  });
  if (!result) throw new NotFoundError();

  if (
    result.previousStorageKey &&
    result.previousStorageKey !== input.storageKey
  ) {
    try {
      await deleteStoredObject(result.previousStorageKey);
    } catch { }
  }

  return result.expense;
}

export async function getExpenseBillDownloadUrl(
  session: RoleSession,
  expenseId: string,
) {
  assertCanAccessExpenses(session);
  const expense = await findExpenseById(session.garageId, expenseId);
  if (!expense?.billStorageKey) {
    throw new NotFoundError();
  }
  return createPresignedDownloadUrl(expense.billStorageKey);
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

  if (expense.billStorageKey) {
    try {
      await deleteStoredObject(expense.billStorageKey);
    } catch { }
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

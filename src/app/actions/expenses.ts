"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { getTranslations } from "next-intl/server";
import {
  translateError,
  translateZodFieldErrors,
} from "@/lib/translate-error";
import { requireSession } from "@/lib/session";
import type { CreateExpenseInput } from "@/modules/expenses/schema";
import {
  createExpenseRecord,
  deleteExpenseRecord,
  markExpensePaidRecord,
  updateExpenseRecord,
} from "@/modules/expenses/service";

export type ExpenseActionState = {
  ok: boolean;
  message?: string;
  expenseId?: string;
  fieldErrors?: Record<string, string>;
};

function formPayload(formData: FormData): CreateExpenseInput {
  const statusRaw = String(formData.get("status") ?? "PAID");
  const status = statusRaw === "UNPAID" ? "UNPAID" : "PAID";
  return {
    amountRupees: String(formData.get("amountRupees") ?? ""),
    spentAt: String(formData.get("spentAt") ?? ""),
    status,
    method: String(formData.get("method") ?? "") as CreateExpenseInput["method"],
    category: String(formData.get("category") ?? ""),
    note: String(formData.get("note") ?? ""),
  };
}

export async function createExpenseModalAction(
  _prev: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const t = await getTranslations("expenses");
  try {
    const session = await requireSession();
    const expense = await createExpenseRecord(session, formPayload(formData));
    revalidatePath("/expenses");
    return { ok: true, message: t("created"), expenseId: expense.id };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        ok: false,
        message: await translateError(error),
        fieldErrors: await translateZodFieldErrors(error),
      };
    }
    return { ok: false, message: await translateError(error) };
  }
}

export async function updateExpenseModalAction(
  expenseId: string,
  _prev: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const t = await getTranslations("expenses");
  try {
    const session = await requireSession();
    await updateExpenseRecord(session, expenseId, formPayload(formData));
    revalidatePath("/expenses");
    return { ok: true, message: t("updated"), expenseId };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        ok: false,
        message: await translateError(error),
        fieldErrors: await translateZodFieldErrors(error),
      };
    }
    return { ok: false, message: await translateError(error) };
  }
}

export async function markExpensePaidAction(
  expenseId: string,
  _prev: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const t = await getTranslations("expenses");
  try {
    const session = await requireSession();
    await markExpensePaidRecord(session, {
      expenseId,
      method: String(formData.get("method") ?? "") as "CASH" | "UPI" | "CARD",
      spentAt: String(formData.get("spentAt") ?? "") || undefined,
    });
    revalidatePath("/expenses");
    return { ok: true, message: t("markedPaid"), expenseId };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        ok: false,
        message: await translateError(error),
        fieldErrors: await translateZodFieldErrors(error),
      };
    }
    return { ok: false, message: await translateError(error) };
  }
}

export async function deleteExpenseAction(
  expenseId: string,
): Promise<ExpenseActionState> {
  const t = await getTranslations("expenses");
  try {
    const session = await requireSession();
    await deleteExpenseRecord(session, expenseId);
    revalidatePath("/expenses");
    return { ok: true, message: t("deleted") };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

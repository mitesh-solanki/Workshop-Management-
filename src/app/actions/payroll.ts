"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { translateError } from "@/lib/translate-error";
import { requireSession } from "@/lib/session";
import { findPayrollLine } from "@/modules/payroll/repo";
import {
  createPayrollRun,
  deleteAdvance,
  deleteBonus,
  deletePayrollLine,
  generateMonthPayroll,
  giveAdvance,
  giveBonus,
  markPayrollLinePaid,
  savePayProfile,
  unmarkPayrollLinePaid,
  updateAdvance,
  updateBonus,
  updatePayrollLine,
} from "@/modules/payroll/service";

export type PayrollActionState = {
  ok: boolean;
  message?: string;
  runId?: string;
  fieldErrors?: Record<string, string>;
};

function revalidatePayrollPaths(userId?: string, runId?: string) {
  revalidatePath("/payroll");
  revalidatePath("/team");
  if (userId) revalidatePath(`/team/${userId}`);
  if (runId) revalidatePath(`/payroll/${runId}`);
}

export async function savePayProfileAction(
  _prev: PayrollActionState,
  formData: FormData,
): Promise<PayrollActionState> {
  const t = await getTranslations("payroll");
  try {
    const session = await requireSession();
    const userId = String(formData.get("userId") ?? "");
    await savePayProfile(session, {
      userId,
      basicRupees: String(formData.get("basicRupees") ?? ""),
      payMode: String(formData.get("payMode") ?? "FULL_BASIC") as "FULL_BASIC",
    });
    revalidatePayrollPaths(userId);
    return { ok: true, message: t("payProfileSaved") };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

export async function giveAdvanceAction(
  _prev: PayrollActionState,
  formData: FormData,
): Promise<PayrollActionState> {
  const t = await getTranslations("payroll");
  try {
    const session = await requireSession();
    const userId = String(formData.get("userId") ?? "");
    await giveAdvance(session, {
      userId,
      amountRupees: String(formData.get("amountRupees") ?? ""),
      givenOn: String(formData.get("givenOn") ?? ""),
      method: String(formData.get("method") ?? "") as "CASH" | "UPI" | "CARD" | "MIXED",
      note: String(formData.get("note") ?? ""),
    });
    revalidatePayrollPaths(userId);
    return { ok: true, message: t("advanceGiven") };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

export async function giveBonusAction(
  _prev: PayrollActionState,
  formData: FormData,
): Promise<PayrollActionState> {
  const t = await getTranslations("payroll");
  try {
    const session = await requireSession();
    const userId = String(formData.get("userId") ?? "");
    await giveBonus(session, {
      userId,
      amountRupees: String(formData.get("amountRupees") ?? ""),
      givenOn: String(formData.get("givenOn") ?? ""),
      method: String(formData.get("method") ?? "") as "CASH" | "UPI" | "CARD" | "MIXED",
      note: String(formData.get("note") ?? ""),
    });
    revalidatePayrollPaths(userId);
    return { ok: true, message: t("bonusGiven") };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

export async function updateAdvanceAction(
  _prev: PayrollActionState,
  formData: FormData,
): Promise<PayrollActionState> {
  const t = await getTranslations("payroll");
  try {
    const session = await requireSession();
    const userId = await updateAdvance(session, {
      advanceId: String(formData.get("advanceId") ?? ""),
      amountRupees: String(formData.get("amountRupees") ?? ""),
      givenOn: String(formData.get("givenOn") ?? ""),
      method: String(formData.get("method") ?? "") as
        | "CASH"
        | "UPI"
        | "CARD"
        | "MIXED",
      note: String(formData.get("note") ?? ""),
    });
    revalidatePayrollPaths(userId);
    return { ok: true, message: t("advanceUpdated") };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

export async function deleteAdvanceAction(
  advanceId: string,
): Promise<PayrollActionState> {
  const t = await getTranslations("payroll");
  try {
    const session = await requireSession();
    const userId = await deleteAdvance(session, { advanceId });
    revalidatePayrollPaths(userId);
    return { ok: true, message: t("advanceDeleted") };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

export async function updateBonusAction(
  _prev: PayrollActionState,
  formData: FormData,
): Promise<PayrollActionState> {
  const t = await getTranslations("payroll");
  try {
    const session = await requireSession();
    const userId = await updateBonus(session, {
      bonusId: String(formData.get("bonusId") ?? ""),
      amountRupees: String(formData.get("amountRupees") ?? ""),
      givenOn: String(formData.get("givenOn") ?? ""),
      method: String(formData.get("method") ?? "") as
        | "CASH"
        | "UPI"
        | "CARD"
        | "MIXED",
      note: String(formData.get("note") ?? ""),
    });
    revalidatePayrollPaths(userId);
    return { ok: true, message: t("bonusUpdated") };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

export async function deleteBonusAction(
  bonusId: string,
): Promise<PayrollActionState> {
  const t = await getTranslations("payroll");
  try {
    const session = await requireSession();
    const userId = await deleteBonus(session, { bonusId });
    revalidatePayrollPaths(userId);
    return { ok: true, message: t("bonusDeleted") };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

export async function createPayrollRunAction(
  _prev: PayrollActionState,
  formData: FormData,
): Promise<PayrollActionState> {
  const t = await getTranslations("payroll");
  try {
    const session = await requireSession();
    const userIds = formData
      .getAll("userIds")
      .map((value) => String(value).trim())
      .filter(Boolean);
    const lines = userIds.map((userId) => ({
      userId,
      basicRupees: String(formData.get(`basic_${userId}`) ?? ""),
    }));
    const run = await createPayrollRun(session, {
      periodStart: String(formData.get("periodStart") ?? ""),
      periodEnd: String(formData.get("periodEnd") ?? ""),
      lines,
    });
    revalidatePayrollPaths(undefined, run.id);
    return { ok: true, message: t("runCreated"), runId: run.id };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

export async function generateMonthPayrollAction(
  _prev: PayrollActionState,
  formData: FormData,
): Promise<PayrollActionState> {
  const t = await getTranslations("payroll");
  try {
    const session = await requireSession();
    const userIds = formData
      .getAll("userIds")
      .map((value) => String(value).trim())
      .filter(Boolean);
    const lines = userIds.map((userId) => ({
      userId,
      basicRupees: String(formData.get(`basic_${userId}`) ?? ""),
      bonusRupees: String(formData.get(`bonus_${userId}`) ?? ""),
      advanceDeductedRupees: String(
        formData.get(`advance_${userId}`) ?? "",
      ),
      adjustmentRupees: String(formData.get(`adjustment_${userId}`) ?? ""),
      adjustmentNote: String(formData.get(`adjustmentNote_${userId}`) ?? ""),
    }));
    const run = await generateMonthPayroll(session, {
      yearMonth: String(formData.get("yearMonth") ?? ""),
      lines,
    });
    revalidatePayrollPaths(undefined, run?.id);
    return { ok: true, message: t("membersAdded"), runId: run?.id };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

export async function updatePayrollLineAction(
  _prev: PayrollActionState,
  formData: FormData,
): Promise<PayrollActionState> {
  const t = await getTranslations("payroll");
  try {
    const session = await requireSession();
    const lineId = String(formData.get("lineId") ?? "");
    const result = await updatePayrollLine(session, {
      lineId,
      basicRupees: String(formData.get("basicRupees") ?? ""),
      bonusRupees: String(formData.get("bonusRupees") ?? ""),
      commissionRupees: String(formData.get("commissionRupees") ?? "0"),
      advanceDeductedRupees: String(formData.get("advanceDeductedRupees") ?? ""),
      adjustmentRupees: String(formData.get("adjustmentRupees") ?? ""),
      adjustmentNote: String(formData.get("adjustmentNote") ?? ""),
    });
    const line = await findPayrollLine(session.garageId, result.id);
    revalidatePayrollPaths(line?.userId, line?.payrollRunId);
    return { ok: true, message: t("lineUpdated") };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

export async function markPayrollLinePaidAction(
  lineId: string,
  method: "CASH" | "UPI" | "CARD" | "MIXED",
  paidOn?: string,
): Promise<PayrollActionState> {
  const t = await getTranslations("payroll");
  try {
    const session = await requireSession();
    await markPayrollLinePaid(session, { lineId, method, paidOn });
    const line = await findPayrollLine(session.garageId, lineId);
    revalidatePayrollPaths(line?.userId, line?.payrollRunId);
    return { ok: true, message: t("linePaid") };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

export async function unmarkPayrollLinePaidAction(
  lineId: string,
): Promise<PayrollActionState> {
  const t = await getTranslations("payroll");
  try {
    const session = await requireSession();
    await unmarkPayrollLinePaid(session, { lineId });
    const line = await findPayrollLine(session.garageId, lineId);
    revalidatePayrollPaths(line?.userId, line?.payrollRunId);
    return { ok: true, message: t("lineUnpaid") };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

export async function deletePayrollLineAction(
  lineId: string,
): Promise<PayrollActionState> {
  const t = await getTranslations("payroll");
  try {
    const session = await requireSession();
    const line = await findPayrollLine(session.garageId, lineId);
    const userId = line?.userId;
    const runId = line?.payrollRunId;
    await deletePayrollLine(session, { lineId });
    revalidatePayrollPaths(userId, runId);
    return { ok: true, message: t("lineDeleted") };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}


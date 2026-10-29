"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { translateError } from "@/lib/translate-error";
import {
  addManualEstimateLine,
  agreeAllPendingEstimateLines,
  createEstimateFromSources,
  createEstimateRevision,
  removeEstimateLine,
  savePermissionLine,
  setEstimateLineApproval,
} from "@/modules/estimates/service";
import type {
  EstimateApprovalMethodValue,
  EstimateApprovalStateValue,
  EstimateLineTypeValue,
} from "@/modules/estimates/schema";

export type EstimateActionState = {
  ok: boolean;
  message?: string;
  askPermission?: boolean;
  permissionVia?: "MANUAL" | "LIVE_LINK" | null;
  /** When set, UI can link to `/inventory/{stockPartId}`. */
  stockPartId?: string;
};

function revalidateEstimate(orderId: string) {
  revalidatePath(`/orders/${orderId}`);
  revalidatePath(`/orders/${orderId}/estimate`);
}

async function failEstimateAction(error: unknown): Promise<EstimateActionState> {
  const message = await translateError(error);
  if (
    error instanceof AppError &&
    error.code === "inventory.insufficient_stock"
  ) {
    const stockPartId = String(error.params?.partId ?? "").trim();
    return {
      ok: false,
      message,
      ...(stockPartId ? { stockPartId } : {}),
    };
  }
  return { ok: false, message };
}

export async function createEstimateAction(
  orderId: string,
  _prev: EstimateActionState,
  formData: FormData,
): Promise<EstimateActionState> {
  try {
    const session = await requireSession();
    const askPermissionRaw = String(formData.get("askPermission") ?? "no");
    const permissionViaRaw = String(formData.get("permissionVia") ?? "");
    const permissionVia =
      permissionViaRaw === "MANUAL" || permissionViaRaw === "LIVE_LINK"
        ? permissionViaRaw
        : null;
    const estimate = await createEstimateFromSources(session, orderId, {
      notes: String(formData.get("notes") ?? ""),
      askPermission: askPermissionRaw,
      permissionVia,
    });
    revalidateEstimate(orderId);
    return {
      ok: true,
      message: "estimateCreated",
      askPermission: estimate.askPermission,
      permissionVia: estimate.permissionVia,
    };
  } catch (error) {
    return failEstimateAction(error);
  }
}

export async function createEstimateRevisionAction(
  orderId: string,
  _prev: EstimateActionState,
  formData: FormData,
): Promise<EstimateActionState> {
  try {
    const session = await requireSession();
    await createEstimateRevision(session, orderId, {
      notes: String(formData.get("notes") ?? ""),
    });
    revalidateEstimate(orderId);
    return { ok: true, message: "revisionCreated" };
  } catch (error) {
    return failEstimateAction(error);
  }
}

export async function addEstimateLineAction(
  orderId: string,
  _prev: EstimateActionState,
  formData: FormData,
): Promise<EstimateActionState> {
  try {
    const session = await requireSession();
    const description = String(formData.get("description") ?? "").trim();
    await addManualEstimateLine(session, orderId, {
      type: String(formData.get("type") ?? "") as EstimateLineTypeValue,
      description,
      quantity: String(formData.get("quantity") ?? "1"),
      unitPricePaise: String(formData.get("unitPriceRupees") ?? "0"),
      gstRatePercent: String(formData.get("gstRatePercent") ?? "18"),
      hsnOrSac: String(formData.get("hsnOrSac") ?? ""),
    });
    revalidateEstimate(orderId);
    return { ok: true, message: "lineAdded" };
  } catch (error) {
    return failEstimateAction(error);
  }
}

export async function setLineApprovalAction(
  orderId: string,
  lineId: string,
  _prev: EstimateActionState,
  formData: FormData,
): Promise<EstimateActionState> {
  try {
    const session = await requireSession();
    await setEstimateLineApproval(session, lineId, {
      approvalState: String(
        formData.get("approvalState") ?? "",
      ) as EstimateApprovalStateValue,
      method: String(
        formData.get("method") ?? "",
      ) as EstimateApprovalMethodValue,
      note: String(formData.get("note") ?? ""),
    });
    revalidateEstimate(orderId);
    return { ok: true, message: "approvalSaved" };
  } catch (error) {
    return failEstimateAction(error);
  }
}

export async function agreeAllPendingLinesAction(
  orderId: string,
): Promise<EstimateActionState> {
  try {
    const session = await requireSession();
    const result = await agreeAllPendingEstimateLines(session, orderId);
    revalidateEstimate(orderId);
    return {
      ok: true,
      message: result.count > 0 ? "agreeAllSaved" : "approvalSaved",
    };
  } catch (error) {
    return failEstimateAction(error);
  }
}

export async function deleteEstimateLineAction(
  orderId: string,
  lineId: string,
): Promise<EstimateActionState> {
  try {
    const session = await requireSession();
    await removeEstimateLine(session, lineId);
    revalidateEstimate(orderId);
    return { ok: true, message: "lineRemoved" };
  } catch (error) {
    return failEstimateAction(error);
  }
}

export async function savePermissionLineAction(
  orderId: string,
  lineId: string,
  _prev: EstimateActionState,
  formData: FormData,
): Promise<EstimateActionState> {
  try {
    const session = await requireSession();
    await savePermissionLine(session, lineId, {
      description: String(formData.get("description") ?? ""),
      quantity: String(formData.get("quantity") ?? "1"),
      unitPricePaise: String(formData.get("unitPriceRupees") ?? "0"),
      approvalState: String(
        formData.get("approvalState") ?? "",
      ) as EstimateApprovalStateValue,
      method: String(
        formData.get("method") ?? "",
      ) as EstimateApprovalMethodValue,
      note: String(formData.get("note") ?? ""),
    });
    revalidateEstimate(orderId);
    return { ok: true, message: "approvalSaved" };
  } catch (error) {
    return failEstimateAction(error);
  }
}

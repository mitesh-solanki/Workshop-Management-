"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { translateError } from "@/lib/translate-error";
import {
  addManualEstimateLine,
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
};

function revalidateEstimate(orderId: string) {
  revalidatePath(`/orders/${orderId}`);
  revalidatePath(`/orders/${orderId}/estimate`);
}

export async function createEstimateAction(
  orderId: string,
  _prev: EstimateActionState,
  formData: FormData,
): Promise<EstimateActionState> {
  try {
    const session = await requireSession();
    await createEstimateFromSources(session, orderId, {
      notes: String(formData.get("notes") ?? ""),
    });
    revalidateEstimate(orderId);
    return { ok: true, message: "estimateCreated" };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof AppError ? error.message : "Something went wrong",
    };
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
    return {
      ok: false,
      message: error instanceof AppError ? error.message : "Something went wrong",
    };
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
    return {
      ok: false,
      message: error instanceof AppError ? error.message : "Something went wrong",
    };
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
    return {
      ok: false,
      message: error instanceof AppError ? error.message : "Something went wrong",
    };
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
    return {
      ok: false,
      message: await translateError(error),
    };
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
    return {
      ok: false,
      message: error instanceof AppError ? error.message : "Something went wrong",
    };
  }
}

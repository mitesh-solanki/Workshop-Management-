"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { translateError } from "@/lib/translate-error";
import {
  addManualEstimateLine,
  addManualInspectionEstimateLine,
  agreeAllPendingEstimateLines,
  agreeAllPendingInspectionEstimateLines,
  createEstimateFromInspection,
  createEstimateFromSources,
  createEstimateRevision,
  removeEstimateLine,
  savePermissionLine,
  setEstimateLineApproval,
  syncInspectionEstimateFromItems,
} from "@/modules/estimates/service";
import type {
  EstimateApprovalMethodValue,
  EstimateApprovalStateValue,
  EstimateLineTypeValue,
} from "@/modules/estimates/schema";
import {
  parseInspectionItemsJson,
  saveExistingInspection,
} from "@/modules/inspections/service";
import { createLiveLink } from "@/modules/live-link/service";

export type EstimateActionState = {
  ok: boolean;
  message?: string;
  askPermission?: boolean;
  permissionVia?: "MANUAL" | "LIVE_LINK" | null;
  liveLinkUrl?: string;
  stockPartId?: string;
};

function revalidateEstimate(orderId: string) {
  revalidatePath(`/orders/${orderId}`);
  revalidatePath(`/orders/${orderId}/estimate`);
}

function revalidateInspectionEstimate(inspectionId: string) {
  revalidatePath(`/inspections/${inspectionId}`);
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
    let liveLinkUrl: string | undefined;
    if (estimate.askPermission && estimate.permissionVia === "LIVE_LINK") {
      try {
        const link = await createLiveLink(session, { serviceOrderId: orderId });
        liveLinkUrl = link.url;
      } catch {
        liveLinkUrl = undefined;
      }
    }
    revalidateEstimate(orderId);
    return {
      ok: true,
      message: "estimateCreated",
      askPermission: estimate.askPermission,
      permissionVia: estimate.permissionVia,
      ...(liveLinkUrl ? { liveLinkUrl } : {}),
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

export async function createInspectionEstimateAction(
  inspectionId: string,
  _prev: EstimateActionState,
  formData: FormData,
): Promise<EstimateActionState> {
  try {
    const session = await requireSession();
    const itemsJson = String(formData.get("itemsJson") ?? "").trim();
    // Persist the same priced findings shown on Report before building the estimate.
    if (itemsJson) {
      await saveExistingInspection(session, inspectionId, {
        customerId: String(formData.get("customerId") ?? ""),
        vehicleId: String(formData.get("vehicleId") ?? ""),
        complaint: String(formData.get("complaint") ?? ""),
        recommendedNotes: String(formData.get("recommendedNotes") ?? ""),
        items: parseInspectionItemsJson(itemsJson),
      });
    }
    const askPermissionRaw = String(formData.get("askPermission") ?? "no");
    const permissionViaRaw = String(formData.get("permissionVia") ?? "");
    const permissionVia =
      permissionViaRaw === "MANUAL" || permissionViaRaw === "LIVE_LINK"
        ? permissionViaRaw
        : null;
    const estimate = await createEstimateFromInspection(session, inspectionId, {
      notes: String(formData.get("notes") ?? ""),
      askPermission: askPermissionRaw,
      permissionVia,
    });
    let liveLinkUrl: string | undefined;
    if (estimate.askPermission && estimate.permissionVia === "LIVE_LINK") {
      try {
        const link = await createLiveLink(session, { inspectionId });
        liveLinkUrl = link.url;
      } catch {
        liveLinkUrl = undefined;
      }
    }
    revalidateInspectionEstimate(inspectionId);
    return {
      ok: true,
      message: "estimateCreated",
      askPermission: estimate.askPermission,
      permissionVia: estimate.permissionVia,
      ...(liveLinkUrl ? { liveLinkUrl } : {}),
    };
  } catch (error) {
    return failEstimateAction(error);
  }
}

export async function syncInspectionEstimateFromItemsAction(
  inspectionId: string,
  draft?: {
    customerId: string;
    vehicleId: string;
    complaint: string;
    recommendedNotes: string;
    itemsJson: string;
  },
): Promise<EstimateActionState> {
  try {
    const session = await requireSession();
    // Save live findings first so new priced items (e.g. Radiator) exist on the server.
    if (draft?.itemsJson.trim()) {
      await saveExistingInspection(session, inspectionId, {
        customerId: draft.customerId,
        vehicleId: draft.vehicleId,
        complaint: draft.complaint,
        recommendedNotes: draft.recommendedNotes,
        items: parseInspectionItemsJson(draft.itemsJson),
      });
    }
    const result = await syncInspectionEstimateFromItems(session, inspectionId);
    revalidateInspectionEstimate(inspectionId);
    return {
      ok: true,
      message:
        result.addedCount > 0 || result.updatedCount > 0
          ? "linesSynced"
          : "linesAlreadySynced",
    };
  } catch (error) {
    return failEstimateAction(error);
  }
}

export async function agreeAllPendingInspectionEstimateLinesAction(
  inspectionId: string,
): Promise<EstimateActionState> {
  try {
    const session = await requireSession();
    const result = await agreeAllPendingInspectionEstimateLines(
      session,
      inspectionId,
    );
    revalidateInspectionEstimate(inspectionId);
    return {
      ok: true,
      message: result.count > 0 ? "agreeAllSaved" : "approvalSaved",
    };
  } catch (error) {
    return failEstimateAction(error);
  }
}

export async function addInspectionEstimateLineAction(
  inspectionId: string,
  _prev: EstimateActionState,
  formData: FormData,
): Promise<EstimateActionState> {
  try {
    const session = await requireSession();
    await addManualInspectionEstimateLine(session, inspectionId, {
      type: String(formData.get("type") ?? "PART") as EstimateLineTypeValue,
      description: String(formData.get("description") ?? "").trim(),
      quantity: String(formData.get("quantity") ?? "1"),
      unitPricePaise: String(formData.get("unitPriceRupees") ?? "0"),
      gstRatePercent: String(formData.get("gstRatePercent") ?? "0"),
      hsnOrSac: String(formData.get("hsnOrSac") ?? ""),
    });
    revalidateInspectionEstimate(inspectionId);
    return { ok: true, message: "lineAdded" };
  } catch (error) {
    return failEstimateAction(error);
  }
}

export async function saveInspectionEstimateLineAction(
  inspectionId: string,
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
        formData.get("method") ?? "MANUAL",
      ) as EstimateApprovalMethodValue,
      note: String(formData.get("note") ?? ""),
    });
    revalidateInspectionEstimate(inspectionId);
    return { ok: true, message: "lineSaved" };
  } catch (error) {
    return failEstimateAction(error);
  }
}

export async function deleteInspectionEstimateLineAction(
  inspectionId: string,
  lineId: string,
): Promise<EstimateActionState> {
  try {
    const session = await requireSession();
    await removeEstimateLine(session, lineId);
    revalidateInspectionEstimate(inspectionId);
    return { ok: true, message: "lineRemoved" };
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

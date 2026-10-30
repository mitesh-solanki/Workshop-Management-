"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { translateError } from "@/lib/translate-error";
import {
  addChecklistItem,
  addSuggestedRepairLine,
  confirmMediaUpload,
  createInspection,
  createMediaUploadUrl,
  deleteInspection,
  parseInspectionItemsJson,
  removeMedia,
  removeSuggestedRepair,
  saveExistingInspection,
  saveNewInspection,
  updateInspectionItem,
  updateInspectionNotes,
} from "@/modules/inspections/service";

export type InspectionActionState = {
  ok: boolean;
  message?: string;
  inspectionId?: string;
};

async function fail(error: unknown): Promise<InspectionActionState> {
  if (error instanceof ZodError || error instanceof AppError) {
    return { ok: false, message: await translateError(error) };
  }
  return { ok: false, message: await translateError(error) };
}

function revalidateInspection(inspectionId: string) {
  revalidatePath("/inspections");
  revalidatePath(`/inspections/${inspectionId}`);
}

export async function createInspectionAction(
  _prev: InspectionActionState,
  formData: FormData,
): Promise<InspectionActionState> {
  try {
    const session = await requireSession();
    const inspection = await createInspection(session, {
      customerId: String(formData.get("customerId") ?? ""),
      vehicleId: String(formData.get("vehicleId") ?? ""),
    });
    revalidatePath("/inspections");
    revalidatePath(`/customers/${inspection.customerId}`);
    revalidatePath(`/vehicles/${inspection.vehicleId}`);
    return { ok: true, message: "created", inspectionId: inspection.id };
  } catch (error) {
    return await fail(error);
  }
}

/** Creates the inspection shell so checklist items (and Proof) can persist immediately. */
export async function startInspectionAction(input: {
  customerId: string;
  vehicleId: string;
  complaint?: string;
  recommendedNotes?: string;
  expectedCompletion?: string;
}): Promise<InspectionActionState> {
  try {
    const session = await requireSession();
    const inspection = await saveNewInspection(session, {
      customerId: input.customerId,
      vehicleId: input.vehicleId,
      complaint: input.complaint ?? "",
      recommendedNotes: input.recommendedNotes ?? "",
      expectedCompletion: input.expectedCompletion ?? "",
      items: [],
    });
    revalidatePath("/inspections");
    revalidatePath(`/inspections/${inspection.id}`);
    revalidatePath(`/customers/${inspection.customerId}`);
    revalidatePath(`/vehicles/${inspection.vehicleId}`);
    return { ok: true, message: "created", inspectionId: inspection.id };
  } catch (error) {
    return await fail(error);
  }
}

export async function deleteInspectionAction(
  inspectionId: string,
): Promise<InspectionActionState> {
  try {
    const session = await requireSession();
    const result = await deleteInspection(session, inspectionId);
    revalidatePath("/inspections");
    revalidatePath(`/inspections/${inspectionId}`);
    revalidatePath(`/customers/${result.customerId}`);
    revalidatePath(`/vehicles/${result.vehicleId}`);
    return { ok: true, message: "deleted" };
  } catch (error) {
    return await fail(error);
  }
}

export async function saveInspectionAction(
  inspectionId: string | null,
  _prev: InspectionActionState,
  formData: FormData,
): Promise<InspectionActionState> {
  try {
    const session = await requireSession();
    const payload = {
      customerId: String(formData.get("customerId") ?? ""),
      vehicleId: String(formData.get("vehicleId") ?? ""),
      complaint: String(formData.get("complaint") ?? ""),
      recommendedNotes: String(formData.get("recommendedNotes") ?? ""),
      expectedCompletion: String(formData.get("expectedCompletion") ?? ""),
      items: parseInspectionItemsJson(String(formData.get("itemsJson") ?? "[]")),
    };
    const inspection = inspectionId
      ? await saveExistingInspection(session, inspectionId, payload)
      : await saveNewInspection(session, payload);
    revalidatePath("/inspections");
    revalidatePath(`/inspections/${inspection.id}`);
    revalidatePath(`/customers/${inspection.customerId}`);
    revalidatePath(`/vehicles/${inspection.vehicleId}`);
    return {
      ok: true,
      message: inspectionId ? "updated" : "created",
      inspectionId: inspection.id,
    };
  } catch (error) {
    return await fail(error);
  }
}

export async function updateInspectionNotesAction(
  inspectionId: string,
  _prev: InspectionActionState,
  formData: FormData,
): Promise<InspectionActionState> {
  try {
    const session = await requireSession();
    await updateInspectionNotes(session, inspectionId, {
      complaint: String(formData.get("complaint") ?? ""),
      recommendedNotes: String(formData.get("recommendedNotes") ?? ""),
    });
    revalidateInspection(inspectionId);
    return { ok: true, message: "notesSaved" };
  } catch (error) {
    return await fail(error);
  }
}

export async function updateInspectionItemAction(
  itemId: string,
  inspectionId: string,
  _prev: InspectionActionState,
  formData: FormData,
): Promise<InspectionActionState> {
  try {
    const session = await requireSession();
    await updateInspectionItem(session, itemId, {
      result: String(formData.get("result") ?? "") as
        | "OK"
        | "NEEDS_ATTENTION"
        | "URGENT"
        | "",
      notes: String(formData.get("notes") ?? ""),
      quantity: String(formData.get("quantity") ?? ""),
      unitPricePaise: String(formData.get("unitPriceRupees") ?? ""),
      externalCheck: String(formData.get("externalCheck") ?? ""),
      label: String(formData.get("label") ?? ""),
    });
    revalidateInspection(inspectionId);
    return { ok: true, message: "itemSaved" };
  } catch (error) {
    return await fail(error);
  }
}

/** Saves condition without revalidating the page (avoids a full refresh). */
export async function updateInspectionConditionAction(
  itemId: string,
  result: "OK" | "NEEDS_ATTENTION" | "URGENT" | "",
  notes: string,
): Promise<InspectionActionState> {
  try {
    const session = await requireSession();
    await updateInspectionItem(session, itemId, { result, notes });
    return { ok: true, message: "itemSaved" };
  } catch (error) {
    return await fail(error);
  }
}

/** Saves External Check without a full page refresh. */
export async function updateInspectionExternalCheckAction(
  itemId: string,
  externalCheck: boolean,
  notes: string,
  result: "OK" | "NEEDS_ATTENTION" | "URGENT" | "",
): Promise<InspectionActionState> {
  try {
    const session = await requireSession();
    await updateInspectionItem(session, itemId, {
      result,
      notes,
      externalCheck,
    });
    return { ok: true, message: "itemSaved" };
  } catch (error) {
    return await fail(error);
  }
}

export async function addChecklistItemAction(
  inspectionId: string,
  _prev: InspectionActionState,
  formData: FormData,
): Promise<InspectionActionState> {
  try {
    const session = await requireSession();
    await addChecklistItem(session, inspectionId, {
      label: String(formData.get("label") ?? ""),
    });
    revalidateInspection(inspectionId);
    return { ok: true, message: "itemAdded" };
  } catch (error) {
    return await fail(error);
  }
}

/** Creates a checklist item and returns its id so Proof can upload immediately. */
export async function createInspectionItemAction(
  inspectionId: string,
  label: string,
): Promise<
  | { ok: true; item: { id: string; key: string; label: string } }
  | { ok: false; message: string }
> {
  try {
    const session = await requireSession();
    const item = await addChecklistItem(session, inspectionId, { label });
    revalidateInspection(inspectionId);
    return {
      ok: true,
      item: { id: item.id, key: item.key, label: item.label },
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof AppError ? error.message : "Something went wrong",
    };
  }
}

export async function addSuggestedRepairAction(
  inspectionId: string,
  _prev: InspectionActionState,
  formData: FormData,
): Promise<InspectionActionState> {
  try {
    const session = await requireSession();
    await addSuggestedRepairLine(session, inspectionId, {
      type: String(formData.get("type") ?? "") as "LABOUR" | "PART",
      description: String(formData.get("description") ?? ""),
      quantity: String(formData.get("quantity") ?? "1"),
      unitPricePaise: String(formData.get("unitPriceRupees") ?? "0"),
      partId: String(formData.get("partId") ?? ""),
    });
    revalidateInspection(inspectionId);
    return { ok: true, message: "repairAdded" };
  } catch (error) {
    return await fail(error);
  }
}

export async function removeSuggestedRepairAction(
  repairId: string,
  inspectionId: string,
): Promise<InspectionActionState> {
  try {
    const session = await requireSession();
    await removeSuggestedRepair(session, repairId);
    revalidateInspection(inspectionId);
    return { ok: true, message: "repairRemoved" };
  } catch (error) {
    return await fail(error);
  }
}

export async function removeMediaAction(
  mediaId: string,
  inspectionId: string,
): Promise<InspectionActionState> {
  try {
    const session = await requireSession();
    await removeMedia(session, mediaId);
    revalidateInspection(inspectionId);
    return { ok: true, message: "mediaRemoved" };
  } catch (error) {
    return await fail(error);
  }
}

export async function requestMediaUploadUrlAction(input: {
  inspectionItemId: string;
  kind: "PHOTO" | "VIDEO";
  contentType: string;
  byteSize: number;
}) {
  const session = await requireSession();
  return createMediaUploadUrl(session, input);
}

export async function confirmMediaUploadAction(input: {
  inspectionItemId: string;
  kind: "PHOTO" | "VIDEO";
  storageKey: string;
  contentType: string;
  byteSize: number;
  inspectionId: string;
}) {
  const session = await requireSession();
  const media = await confirmMediaUpload(session, input);
  revalidateInspection(input.inspectionId);
  return media;
}

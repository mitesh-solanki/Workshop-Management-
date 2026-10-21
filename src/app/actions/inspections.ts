"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import {
  addChecklistItem,
  addSuggestedRepairLine,
  confirmMediaUpload,
  createMediaUploadUrl,
  removeMedia,
  removeSuggestedRepair,
  updateInspectionItem,
} from "@/modules/inspections/service";

export type InspectionActionState = {
  ok: boolean;
  message?: string;
};

function fail(error: unknown): InspectionActionState {
  return {
    ok: false,
    message: error instanceof AppError ? error.message : "Something went wrong",
  };
}

export async function updateInspectionItemAction(
  itemId: string,
  orderId: string,
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
    });
    revalidatePath(`/orders/${orderId}`);
    revalidatePath(`/orders/${orderId}/inspection`);
    return { ok: true, message: "itemSaved" };
  } catch (error) {
    return fail(error);
  }
}

export async function addChecklistItemAction(
  orderId: string,
  _prev: InspectionActionState,
  formData: FormData,
): Promise<InspectionActionState> {
  try {
    const session = await requireSession();
    await addChecklistItem(session, orderId, {
      label: String(formData.get("label") ?? ""),
    });
    revalidatePath(`/orders/${orderId}/inspection`);
    return { ok: true, message: "itemAdded" };
  } catch (error) {
    return fail(error);
  }
}

export async function addSuggestedRepairAction(
  orderId: string,
  _prev: InspectionActionState,
  formData: FormData,
): Promise<InspectionActionState> {
  try {
    const session = await requireSession();
    await addSuggestedRepairLine(session, orderId, {
      type: String(formData.get("type") ?? "") as "LABOUR" | "PART",
      description: String(formData.get("description") ?? ""),
      quantity: String(formData.get("quantity") ?? "1"),
      unitPricePaise: String(formData.get("unitPriceRupees") ?? "0"),
    });
    revalidatePath(`/orders/${orderId}/inspection`);
    return { ok: true, message: "repairAdded" };
  } catch (error) {
    return fail(error);
  }
}

export async function removeSuggestedRepairAction(
  repairId: string,
  orderId: string,
): Promise<InspectionActionState> {
  try {
    const session = await requireSession();
    await removeSuggestedRepair(session, repairId);
    revalidatePath(`/orders/${orderId}/inspection`);
    return { ok: true, message: "repairRemoved" };
  } catch (error) {
    return fail(error);
  }
}

export async function removeMediaAction(
  mediaId: string,
  orderId: string,
): Promise<InspectionActionState> {
  try {
    const session = await requireSession();
    await removeMedia(session, mediaId);
    revalidatePath(`/orders/${orderId}/inspection`);
    return { ok: true, message: "mediaRemoved" };
  } catch (error) {
    return fail(error);
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
  orderId: string;
}) {
  const session = await requireSession();
  const media = await confirmMediaUpload(session, input);
  revalidatePath(`/orders/${input.orderId}/inspection`);
  return media;
}

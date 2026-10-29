"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { translateError } from "@/lib/translate-error";
import {
  createVehicleWarranty,
  deleteWarrantyDocument,
  requestWarrantyUploadUrl,
  saveInvoiceLineWarranty,
} from "@/modules/warranties/service";

export type WarrantyActionState = {
  ok: boolean;
  message?: string;
};

export async function requestWarrantyUploadUrlAction(input: {
  vehicleId: string;
  contentType: string;
  byteSize: number;
  fileName?: string;
}) {
  const session = await requireSession();
  return requestWarrantyUploadUrl(session, input);
}

export async function saveInvoiceLineWarrantyAction(input: {
  invoiceId: string;
  invoiceLineId: string;
  warrantyExpiresAt?: string;
  storageKey?: string | null;
  contentType?: string | null;
  byteSize?: number | null;
  fileName?: string | null;
  orderId: string;
}): Promise<WarrantyActionState> {
  try {
    const session = await requireSession();
    const { orderId, ...raw } = input;
    await saveInvoiceLineWarranty(session, raw);
    revalidatePath(`/orders/${orderId}`);
    return { ok: true, message: "saved" };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof AppError
          ? await translateError(error)
          : await translateError(error),
    };
  }
}

export async function createVehicleWarrantyAction(input: {
  vehicleId: string;
  customerId: string;
  partName: string;
  invoiceId?: string;
  orderId?: string;
  warrantyExpiresAt?: string;
  storageKey?: string | null;
  contentType?: string | null;
  byteSize?: number | null;
  fileName?: string | null;
}): Promise<WarrantyActionState> {
  try {
    const session = await requireSession();
    const { customerId, orderId, ...raw } = input;
    await createVehicleWarranty(session, raw);
    revalidatePath(`/vehicles/${input.vehicleId}`);
    revalidatePath(`/customers/${customerId}`);
    if (orderId) {
      revalidatePath(`/orders/${orderId}`);
    }
    return { ok: true, message: "created" };
  } catch (error) {
    return {
      ok: false,
      message: await translateError(error),
    };
  }
}

export async function deleteWarrantyAction(input: {
  warrantyId: string;
  vehicleId: string;
  customerId: string;
  orderId?: string;
}): Promise<WarrantyActionState> {
  try {
    const session = await requireSession();
    await deleteWarrantyDocument(session, { warrantyId: input.warrantyId });
    revalidatePath(`/vehicles/${input.vehicleId}`);
    revalidatePath(`/customers/${input.customerId}`);
    if (input.orderId) {
      revalidatePath(`/orders/${input.orderId}`);
    }
    return { ok: true, message: "deleted" };
  } catch (error) {
    return {
      ok: false,
      message: await translateError(error),
    };
  }
}

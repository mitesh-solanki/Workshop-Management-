"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { translateError } from "@/lib/translate-error";
import { requireSession } from "@/lib/session";
import {
  createVendorRecord,
  deleteVendorRecord,
  updateVendorRecord,
} from "@/modules/vendors/service";

export type VendorActionState = {
  ok: boolean;
  message?: string;
  vendorId?: string;
  fieldErrors?: Record<string, string>;
};

export async function createVendorModalAction(
  _prev: VendorActionState,
  formData: FormData,
): Promise<VendorActionState> {
  const t = await getTranslations("vendors");
  try {
    const session = await requireSession();
    const vendor = await createVendorRecord(session, {
      name: String(formData.get("name") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      email: String(formData.get("email") ?? ""),
      address: String(formData.get("address") ?? ""),
      gstin: String(formData.get("gstin") ?? ""),
      notes: String(formData.get("notes") ?? ""),
    });
    revalidatePath("/vendors");
    return { ok: true, message: t("created"), vendorId: vendor.id };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

export async function updateVendorModalAction(
  vendorId: string,
  _prev: VendorActionState,
  formData: FormData,
): Promise<VendorActionState> {
  const t = await getTranslations("vendors");
  try {
    const session = await requireSession();
    await updateVendorRecord(session, vendorId, {
      name: String(formData.get("name") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      email: String(formData.get("email") ?? ""),
      address: String(formData.get("address") ?? ""),
      gstin: String(formData.get("gstin") ?? ""),
      notes: String(formData.get("notes") ?? ""),
    });
    revalidatePath("/vendors");
    revalidatePath(`/vendors/${vendorId}`);
    return { ok: true, message: t("updated"), vendorId };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

export async function deleteVendorAction(
  vendorId: string,
): Promise<VendorActionState> {
  const t = await getTranslations("vendors");
  try {
    const session = await requireSession();
    await deleteVendorRecord(session, vendorId);
    revalidatePath("/vendors");
    return { ok: true, message: t("deleted") };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { translateError } from "@/lib/translate-error";
import { requireSession } from "@/lib/session";
import { parseDirectSaleFormData } from "@/modules/inventory/direct-sale-form-data";
import {
  createDirectSaleRecord,
  createPartRecord,
  recordStockAdjustment,
  recordStockIn,
  recordStockOut,
  updatePartRecord,
} from "@/modules/inventory/service";

export type InventoryActionState = {
  ok: boolean;
  message?: string;
  partId?: string;
};

function parsePartForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    sku: String(formData.get("sku") ?? ""),
    unit: String(formData.get("unit") ?? ""),
    purchasePricePaise: String(formData.get("purchasePriceRupees") ?? "0"),
    sellingPricePaise: String(formData.get("sellingPriceRupees") ?? "0"),
    gstRatePercent: String(formData.get("gstRatePercent") ?? "18"),
    hsn: String(formData.get("hsn") ?? ""),
    lowStockLevel: String(formData.get("lowStockLevel") ?? "0"),
    openingStock: String(formData.get("openingStock") ?? "0"),
  };
}

export async function createPartAction(
  _prev: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  let partId: string;
  try {
    const session = await requireSession();
    const part = await createPartRecord(session, parsePartForm(formData));
    partId = part.id;
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }

  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  redirect(`/inventory/${partId}`);
}

/** Modal create — returns partId so the client can navigate (no redirect). */
export async function createPartModalAction(
  _prev: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const t = await getTranslations("inventory");
  try {
    const session = await requireSession();
    const part = await createPartRecord(session, parsePartForm(formData));
    revalidatePath("/inventory");
    revalidatePath("/dashboard");
    return { ok: true, message: t("created"), partId: part.id };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

export async function updatePartAction(
  partId: string,
  _prev: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const t = await getTranslations("inventory");
  try {
    const session = await requireSession();
    const parsed = parsePartForm(formData);
    await updatePartRecord(session, partId, {
      name: parsed.name,
      sku: parsed.sku,
      unit: parsed.unit,
      purchasePricePaise: parsed.purchasePricePaise,
      sellingPricePaise: parsed.sellingPricePaise,
      gstRatePercent: parsed.gstRatePercent,
      hsn: parsed.hsn,
      lowStockLevel: parsed.lowStockLevel,
    });
    revalidatePath("/inventory");
    revalidatePath(`/inventory/${partId}`);
    revalidatePath("/dashboard");
    return { ok: true, message: t("saved") };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

export async function stockInAction(
  partId: string,
  _prev: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  try {
    const session = await requireSession();
    await recordStockIn(session, {
      partId,
      quantity: String(formData.get("quantity") ?? ""),
      note: String(formData.get("note") ?? ""),
    });
    revalidatePath("/inventory");
    revalidatePath(`/inventory/${partId}`);
    revalidatePath("/dashboard");
    return { ok: true, message: "stockInOk" };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

export async function stockOutAction(
  partId: string,
  _prev: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  try {
    const session = await requireSession();
    await recordStockOut(session, {
      partId,
      quantity: String(formData.get("quantity") ?? ""),
      note: String(formData.get("note") ?? ""),
    });
    revalidatePath("/inventory");
    revalidatePath(`/inventory/${partId}`);
    revalidatePath("/dashboard");
    return { ok: true, message: "stockOutOk" };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

export async function stockAdjustAction(
  partId: string,
  _prev: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  try {
    const session = await requireSession();
    await recordStockAdjustment(session, {
      partId,
      quantityChange: String(formData.get("quantityChange") ?? ""),
      note: String(formData.get("note") ?? ""),
    });
    revalidatePath("/inventory");
    revalidatePath(`/inventory/${partId}`);
    revalidatePath("/dashboard");
    return { ok: true, message: "stockAdjustOk" };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

export async function createDirectSaleAction(
  _prev: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  let saleId: string;
  try {
    const session = await requireSession();
    const payload = parseDirectSaleFormData(formData);
    const result = await createDirectSaleRecord(session, payload);
    saleId = result.saleId;
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }

  revalidatePath("/inventory");
  revalidatePath("/inventory/sales");
  revalidatePath("/dashboard");
  redirect(`/inventory/sales/${saleId}`);
}

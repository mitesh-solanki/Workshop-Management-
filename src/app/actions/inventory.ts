"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppError } from "@/lib/errors";
import { multiplyByQuantity, parseRupeesToPaise, paiseToRupeesInput } from "@/lib/money";
import { translateError } from "@/lib/translate-error";
import { requireSession } from "@/lib/session";
import { parseDirectSaleFormData } from "@/modules/inventory/direct-sale-form-data";
import {
  parseShopReceiveLines,
  withShopReceiveBillId,
} from "@/modules/inventory/shop-receive";
import {
  createDirectSaleRecord,
  createPartByNameRecord,
  createPartRecord,
  deleteDirectSaleRecord,
  deletePartRecord,
  getPart,
  getPartForPicker,
  listPartsForCatalogSearchPage,
  listPartsForPickerPage,
  recordStockAdjustment,
  recordStockIn,
  recordStockOut,
  updateDirectSaleRecord,
  updatePartRecord,
} from "@/modules/inventory/service";
import { createVendorBillRecord } from "@/modules/purchases/service";
import { getVendor } from "@/modules/vendors/service";

export type InventoryActionState = {
  ok: boolean;
  message?: string;
  partId?: string;
  partName?: string;
  partSku?: string;
  partUnit?: string;
  saleId?: string;
  vendorBillId?: string;
  /** One id per shop line that created a bill (same order as filled lines). */
  vendorBillIds?: string[];
  /** When set, UI can link to `/inventory/{stockPartId}`. */
  stockPartId?: string;
};

async function failInventoryAction(
  error: unknown,
): Promise<InventoryActionState> {
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
    revalidatePath("/vendors");
    return {
      ok: true,
      message: t("created"),
      partId: part.id,
      partName: part.name,
      partSku: part.sku,
      partUnit: part.unit,
    };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

/**
 * Job-card Add Spare Part: create part, stock in per shop line, Vendor Bills.
 * Optional bill photos uploaded by the client after (one per bill id).
 */
export async function createPartShopReceiveAction(
  _prev: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const t = await getTranslations("inventory");
  try {
    const session = await requireSession();
    const parsed = parsePartForm(formData);
    const shopLines = parseShopReceiveLines(formData);
    const purchasePaise =
      parseRupeesToPaise(String(formData.get("purchasePriceRupees") ?? "0")) ??
      0;

    if (shopLines.length > 0) {
      if (shopLines.some((line) => !line.vendorId || line.quantity <= 0)) {
        return { ok: false, message: t("shopLineIncomplete") };
      }
      if (purchasePaise <= 0) {
        return { ok: false, message: t("purchaseRequiredForStock") };
      }
    }

    const part = await createPartRecord(session, {
      ...parsed,
      // Vendors drive stock-in below; otherwise use the Current Stock field.
      openingStock: shopLines.length > 0 ? "0" : parsed.openingStock,
    });

    if (shopLines.length === 0) {
      revalidatePath("/inventory");
      revalidatePath("/dashboard");
      revalidatePath("/vendors");
      return {
        ok: true,
        message: t("created"),
        partId: part.id,
        partName: part.name,
        partSku: part.sku,
        partUnit: part.unit,
      };
    }

    const vendorBillIds: string[] = [];
    for (const line of shopLines) {
      const vendor = await getVendor(session, line.vendorId);
      const billAmountPaise = multiplyByQuantity(purchasePaise, line.quantity);
      const bill = await createVendorBillRecord(session, {
        vendorId: line.vendorId,
        purchaseOrderId: "",
        billNumber: "",
        billDate: "",
        amountPaise: paiseToRupeesInput(billAmountPaise),
        notes: t("shopReceiveBillNote", { name: part.name }),
      });
      await recordStockIn(session, {
        partId: part.id,
        quantity: String(line.quantity),
        note: withShopReceiveBillId(
          t("shopReceiveStockNote", { vendor: vendor.name }),
          bill.id,
        ),
      });
      vendorBillIds.push(bill.id);
      revalidatePath(`/vendors/${line.vendorId}`);
    }

    if (vendorBillIds.length > 0) {
      revalidatePath("/vendor-bills");
    }
    revalidatePath("/inventory");
    revalidatePath("/dashboard");
    revalidatePath("/vendors");
    return {
      ok: true,
      message:
        vendorBillIds.length > 0
          ? t("shopReceiveSavedWithBill")
          : t("created"),
      partId: part.id,
      partName: part.name,
      partSku: part.sku,
      partUnit: part.unit,
      vendorBillId: vendorBillIds[0],
      vendorBillIds,
    };
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
    const addStockRaw = String(formData.get("addStockQuantity") ?? "").trim();
    const addStockQty = addStockRaw === "" ? 0 : Number(addStockRaw);
    if (Number.isFinite(addStockQty) && addStockQty > 0) {
      await recordStockIn(session, {
        partId,
        quantity: String(addStockQty),
        note: String(formData.get("addStockNote") ?? ""),
      });
    }
    revalidatePath("/inventory");
    revalidatePath(`/inventory/${partId}`);
    revalidatePath("/dashboard");
    return { ok: true, message: t("saved") };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

/**
 * Job-card shop receive: update part, stock in per shop, Vendor Bills.
 * Optional bill photos uploaded by the client after (matched to vendorBillIds).
 */
export async function savePartShopReceiveAction(
  partId: string,
  _prev: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const t = await getTranslations("inventory");
  try {
    const session = await requireSession();
    const parsed = parsePartForm(formData);
    const part = await updatePartRecord(session, partId, {
      name: parsed.name,
      sku: parsed.sku,
      unit: parsed.unit,
      purchasePricePaise: parsed.purchasePricePaise,
      sellingPricePaise: parsed.sellingPricePaise,
      gstRatePercent: parsed.gstRatePercent,
      hsn: parsed.hsn,
      lowStockLevel: parsed.lowStockLevel,
    });

    const shopLines = parseShopReceiveLines(formData);
    const purchasePaise =
      parseRupeesToPaise(String(formData.get("purchasePriceRupees") ?? "0")) ??
      0;

    if (shopLines.length > 0) {
      if (shopLines.some((line) => !line.vendorId || line.quantity <= 0)) {
        return { ok: false, message: t("shopLineIncomplete") };
      }
      if (purchasePaise <= 0) {
        return { ok: false, message: t("purchaseRequiredForStock") };
      }

      const vendorBillIds: string[] = [];
      for (const line of shopLines) {
        const vendor = await getVendor(session, line.vendorId);
        const billAmountPaise = multiplyByQuantity(
          purchasePaise,
          line.quantity,
        );
        const bill = await createVendorBillRecord(session, {
          vendorId: line.vendorId,
          purchaseOrderId: "",
          billNumber: "",
          billDate: "",
          amountPaise: paiseToRupeesInput(billAmountPaise),
          notes: t("shopReceiveBillNote", { name: part.name }),
        });
        await recordStockIn(session, {
          partId,
          quantity: String(line.quantity),
          note: withShopReceiveBillId(
            t("shopReceiveStockNote", { vendor: vendor.name }),
            bill.id,
          ),
        });
        vendorBillIds.push(bill.id);
        revalidatePath(`/vendors/${line.vendorId}`);
      }

      revalidatePath("/inventory");
      revalidatePath(`/inventory/${partId}`);
      revalidatePath("/dashboard");
      revalidatePath("/vendor-bills");
      return {
        ok: true,
        message: t("shopReceiveSavedWithBill"),
        partId,
        vendorBillId: vendorBillIds[0],
        vendorBillIds,
      };
    }

    revalidatePath("/inventory");
    revalidatePath(`/inventory/${partId}`);
    revalidatePath("/dashboard");
    return { ok: true, message: t("saved"), partId };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

export async function deletePartAction(
  partId: string,
): Promise<InventoryActionState> {
  const t = await getTranslations("inventory");
  try {
    const session = await requireSession();
    await deletePartRecord(session, partId);
    revalidatePath("/inventory");
    revalidatePath("/dashboard");
    return { ok: true, message: t("deleted") };
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
    return failInventoryAction(error);
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
    return failInventoryAction(error);
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
    return failInventoryAction(error);
  }
}

export async function createDirectSaleAction(
  _prev: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  try {
    const session = await requireSession();
    const payload = parseDirectSaleFormData(formData);
    await createDirectSaleRecord(session, payload);
  } catch (error) {
    return failInventoryAction(error);
  }

  revalidatePath("/inventory");
  revalidatePath("/inventory/sales");
  revalidatePath("/dashboard");
  redirect("/inventory/sales");
}

export async function createDirectSaleModalAction(
  _prev: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const t = await getTranslations("inventory");
  try {
    const session = await requireSession();
    const payload = parseDirectSaleFormData(formData);
    const result = await createDirectSaleRecord(session, payload);
    revalidatePath("/inventory");
    revalidatePath("/inventory/sales");
    revalidatePath("/dashboard");
    return { ok: true, message: t("saleCreated"), saleId: result.saleId };
  } catch (error) {
    return failInventoryAction(error);
  }
}

export async function updateDirectSaleModalAction(
  _prev: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const t = await getTranslations("inventory");
  try {
    const session = await requireSession();
    const payload = parseDirectSaleFormData(formData);
    const result = await updateDirectSaleRecord(session, {
      saleId: String(formData.get("saleId") ?? ""),
      ...payload,
    });
    revalidatePath("/inventory");
    revalidatePath("/inventory/sales");
    revalidatePath("/dashboard");
    return { ok: true, message: t("saleUpdated"), saleId: result.saleId };
  } catch (error) {
    return failInventoryAction(error);
  }
}

export async function deleteDirectSaleAction(
  saleId: string,
): Promise<InventoryActionState> {
  const t = await getTranslations("inventory");
  try {
    const session = await requireSession();
    await deleteDirectSaleRecord(session, saleId);
    revalidatePath("/inventory");
    revalidatePath("/inventory/sales");
    revalidatePath("/dashboard");
    return { ok: true, message: t("saleDeleted") };
  } catch (error) {
    return failInventoryAction(error);
  }
}

export type PartsPickerPageResult = {
  items: Array<{
    id: string;
    name: string;
    sku: string;
    unit: string;
    sellingPricePaise: number;
    quantityOnHand: number;
  }>;
  nextOffset: number;
  hasMore: boolean;
};

/** Paginated in-stock parts for SearchableSelect (search + scroll load-more). */
export async function searchPartsPickerAction(
  q: string,
  offset = 0,
  pageSize = 25,
): Promise<PartsPickerPageResult> {
  const session = await requireSession();
  return listPartsForPickerPage(session, { q, offset, pageSize });
}

/** Resolve one part for a picker so an already-selected value stays labelled. */
export async function getPartPickerItemAction(
  partId: string,
): Promise<PartsPickerPageResult["items"][number] | null> {
  try {
    const session = await requireSession();
    return await getPartForPicker(session, partId);
  } catch {
    return null;
  }
}

/** Name-only part create from the job-card Item field (no prices or bills). */
export async function createPartByNameAction(name: string): Promise<{
  ok: boolean;
  message?: string;
  part?: PartsPickerPageResult["items"][number];
}> {
  const t = await getTranslations("inventory");
  try {
    const session = await requireSession();
    const part = await createPartByNameRecord(session, { name });
    revalidatePath("/inventory");
    revalidatePath("/orders");
    return {
      ok: true,
      message: t("createdByName"),
      part: {
        id: part.id,
        name: part.name,
        sku: part.sku,
        unit: part.unit,
        sellingPricePaise: 0,
        quantityOnHand: 0,
      },
    };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

/** Name-only create for the Create Part modal (technician job card). */
export async function createPartByNameModalAction(
  _prev: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const t = await getTranslations("inventory");
  try {
    const session = await requireSession();
    const part = await createPartByNameRecord(session, {
      name: String(formData.get("name") ?? ""),
    });
    revalidatePath("/inventory");
    revalidatePath("/orders");
    return {
      ok: true,
      message: t("createdByName"),
      partId: part.id,
      partName: part.name,
      partSku: part.sku,
      partUnit: part.unit,
    };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

/** Full part fields for the inventory edit dialog (e.g. zero-stock from job card). */
export async function getPartEditValuesAction(partId: string): Promise<{
  id: string;
  name: string;
  sku: string;
  unit: string;
  purchasePricePaise: number;
  sellingPricePaise: number;
  gstRatePercent: number;
  hsn: string;
  lowStockLevel: number;
  quantityOnHand: number;
} | null> {
  try {
    const session = await requireSession();
    const part = await getPart(session, partId);
    return {
      id: part.id,
      name: part.name,
      sku: part.sku,
      unit: part.unit,
      purchasePricePaise: part.purchasePricePaise,
      sellingPricePaise: part.sellingPricePaise,
      gstRatePercent: part.gstRatePercent,
      hsn: part.hsn,
      lowStockLevel: part.lowStockLevel,
      quantityOnHand: part.quantityOnHand,
    };
  } catch {
    return null;
  }
}

/** Search all parts (including zero stock). Empty query returns the first browse page. */
export async function searchPartsCatalogAction(
  q: string,
  offset = 0,
  pageSize = 25,
): Promise<PartsPickerPageResult> {
  const session = await requireSession();
  return listPartsForCatalogSearchPage(session, {
    q: q.trim(),
    offset,
    pageSize,
  });
}

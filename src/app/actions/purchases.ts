"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { AppError } from "@/lib/errors";
import { translateError } from "@/lib/translate-error";
import { requireSession } from "@/lib/session";
import {
  cancelPartsRequestRecord,
  confirmVendorBillAttachment,
  createPartsRequestRecord,
  createPurchaseOrderRecord,
  createPurchaseReturnRecord,
  createVendorBillAttachmentUploadUrl,
  createVendorBillRecord,
  receiveGoodsRecord,
  recordVendorBillPaymentRecord,
  removeVendorBillAttachment,
} from "@/modules/purchases/service";

export type PurchasesActionState = {
  ok: boolean;
  message?: string;
  id?: string;
  stockPartId?: string;
};

async function failPurchasesAction(
  error: unknown,
): Promise<PurchasesActionState> {
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

export async function createPartsRequestModalAction(
  _prev: PurchasesActionState,
  formData: FormData,
): Promise<PurchasesActionState> {
  const t = await getTranslations("partsRequests");
  try {
    const session = await requireSession();
    const partId = String(formData.get("partId") ?? "");
    const request = await createPartsRequestRecord(session, {
      partId,
      quantity: Number(formData.get("quantity") ?? 0),
      notes: String(formData.get("notes") ?? ""),
      serviceOrderId: String(formData.get("serviceOrderId") ?? ""),
      serviceOrderLineId: String(formData.get("serviceOrderLineId") ?? ""),
    });
    revalidatePath("/parts-requests");
    revalidatePath("/dashboard");
    revalidatePath("/vendors");
    if (partId) {
      revalidatePath(`/inventory/${partId}`);
    }
    return { ok: true, message: t("created"), id: request.id };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

export async function cancelPartsRequestAction(
  requestId: string,
): Promise<PurchasesActionState> {
  const t = await getTranslations("partsRequests");
  try {
    const session = await requireSession();
    await cancelPartsRequestRecord(session, requestId);
    revalidatePath("/parts-requests");
    return { ok: true, message: t("deleted") };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

export async function createPurchaseOrderModalAction(
  _prev: PurchasesActionState,
  formData: FormData,
): Promise<PurchasesActionState> {
  const t = await getTranslations("purchaseOrders");
  try {
    const session = await requireSession();
    const ids = formData.getAll("partsRequestIds").map(String).filter(Boolean);
    const po = await createPurchaseOrderRecord(session, {
      vendorId: String(formData.get("vendorId") ?? ""),
      notes: String(formData.get("notes") ?? ""),
      partsRequestIds: ids,
    });
    revalidatePath("/purchase-orders");
    revalidatePath("/parts-requests");
    revalidatePath("/vendors");
    return { ok: true, message: t("created"), id: po.id };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

export async function receiveGoodsModalAction(
  purchaseOrderId: string,
  _prev: PurchasesActionState,
  formData: FormData,
): Promise<PurchasesActionState> {
  const t = await getTranslations("purchaseOrders");
  try {
    const session = await requireSession();
    const lineIds = formData.getAll("lineId").map(String);
    const quantities = formData.getAll("quantity").map(String);
    const lines = lineIds.map((purchaseOrderLineId, index) => ({
      purchaseOrderLineId,
      quantity: Number(quantities[index] ?? 0),
    }));
    await receiveGoodsRecord(session, {
      purchaseOrderId,
      notes: String(formData.get("notes") ?? ""),
      lines,
    });
    revalidatePath("/purchase-orders");
    revalidatePath(`/purchase-orders/${purchaseOrderId}`);
    revalidatePath("/inventory");
    return { ok: true, message: t("received") };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

export async function createVendorBillModalAction(
  _prev: PurchasesActionState,
  formData: FormData,
): Promise<PurchasesActionState> {
  const t = await getTranslations("vendorBills");
  try {
    const session = await requireSession();
    const bill = await createVendorBillRecord(session, {
      vendorId: String(formData.get("vendorId") ?? ""),
      purchaseOrderId: String(formData.get("purchaseOrderId") ?? ""),
      billNumber: String(formData.get("billNumber") ?? ""),
      billDate: String(formData.get("billDate") ?? ""),
      amountPaise: String(formData.get("amount") ?? ""),
      notes: String(formData.get("notes") ?? ""),
    });
    revalidatePath("/vendor-bills");
    revalidatePath(`/vendors/${bill.vendorId}`);
    return { ok: true, message: t("created"), id: bill.id };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

export async function recordVendorPaymentModalAction(
  vendorBillId: string,
  _prev: PurchasesActionState,
  formData: FormData,
): Promise<PurchasesActionState> {
  const t = await getTranslations("vendorBills");
  try {
    const session = await requireSession();
    await recordVendorBillPaymentRecord(session, {
      vendorBillId,
      amountPaise: String(formData.get("amount") ?? ""),
      method: String(formData.get("method") ?? "CASH"),
      notes: String(formData.get("notes") ?? ""),
    });
    revalidatePath("/vendor-bills");
    revalidatePath(`/vendor-bills/${vendorBillId}`);
    return { ok: true, message: t("paymentRecorded"), id: vendorBillId };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

export async function requestVendorBillAttachmentUploadUrlAction(input: {
  vendorBillId: string;
  contentType: string;
  byteSize: number;
  fileName?: string;
}) {
  try {
    const session = await requireSession();
    return await createVendorBillAttachmentUploadUrl(session, input);
  } catch (error) {
    throw new Error(await translateError(error));
  }
}

export async function confirmVendorBillAttachmentAction(input: {
  vendorBillId: string;
  storageKey: string;
  contentType: string;
  byteSize: number;
  fileName?: string;
}): Promise<PurchasesActionState> {
  const t = await getTranslations("vendorBills");
  try {
    const session = await requireSession();
    await confirmVendorBillAttachment(session, input);
    revalidatePath("/vendor-bills");
    revalidatePath(`/vendor-bills/${input.vendorBillId}`);
    return { ok: true, message: t("attachmentUploaded") };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

export async function removeVendorBillAttachmentAction(
  vendorBillId: string,
): Promise<PurchasesActionState> {
  const t = await getTranslations("vendorBills");
  try {
    const session = await requireSession();
    await removeVendorBillAttachment(session, vendorBillId);
    revalidatePath("/vendor-bills");
    revalidatePath(`/vendor-bills/${vendorBillId}`);
    return { ok: true, message: t("attachmentRemoved") };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

export async function createPurchaseReturnModalAction(
  _prev: PurchasesActionState,
  formData: FormData,
): Promise<PurchasesActionState> {
  const t = await getTranslations("purchaseReturns");
  try {
    const session = await requireSession();
    const row = await createPurchaseReturnRecord(session, {
      vendorId: String(formData.get("vendorId") ?? ""),
      vendorBillId: String(formData.get("vendorBillId") ?? ""),
      partId: String(formData.get("partId") ?? ""),
      quantity: Number(formData.get("quantity") ?? 0),
      creditPaise: String(formData.get("credit") ?? ""),
      notes: String(formData.get("notes") ?? ""),
    });
    revalidatePath("/purchase-returns");
    revalidatePath("/inventory");
    revalidatePath("/vendor-bills");
    revalidatePath(`/vendors/${row.vendorId}`);
    return { ok: true, message: t("created"), id: row.id };
  } catch (error) {
    return failPurchasesAction(error);
  }
}

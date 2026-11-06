"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { translateError } from "@/lib/translate-error";
import { getTranslations } from "next-intl/server";
import {
  addOrderLine,
  changeOrderStatus,
  confirmOutsideWorkBill,
  confirmPaperCopyUpload,
  createOrder,
  createOutsideWorkBillUploadUrl,
  createPaperCopyUploadUrl,
  deleteOrder,
  getOutsideWorkBillDownloadUrl,
  getSuggestedExpectedCompletionForVehicle,
  listPaperCopies,
  removeOrderLine,
  removePaperCopyUpload,
  replacePaperCopyUpload,
  updateOrder,
  updateOrderLine,
  type SuggestedExpectedCompletion,
} from "@/modules/service-orders/service";

export type ServiceOrderActionState = {
  ok: boolean;
  message?: string;
  orderId?: string;
  lineId?: string;
};

function parseTechnicianIds(formData: FormData): string[] {
  const fromMulti = formData
    .getAll("technicianIds")
    .map((value) => String(value).trim())
    .filter(Boolean);
  if (fromMulti.length > 0) return fromMulti;
  const legacy = String(formData.get("technicianId") ?? "").trim();
  return legacy ? [legacy] : [];
}

function parseCreateOrderForm(formData: FormData) {
  return {
    vehicleId: String(formData.get("vehicleId") ?? ""),
    jobCardNumber: String(formData.get("jobCardNumber") ?? ""),
    complaint: String(formData.get("complaint") ?? ""),
    requestedServices: String(formData.get("requestedServices") ?? ""),
    odometerIn: String(formData.get("odometerIn") ?? ""),
    expectedCompletion: String(formData.get("expectedCompletion") ?? ""),
    technicianIds: parseTechnicianIds(formData),
    bay: String(formData.get("bay") ?? ""),
    priority: String(formData.get("priority") ?? "") as
      | ""
      | "LOW"
      | "NORMAL"
      | "HIGH"
      | "URGENT",
    status: String(formData.get("status") ?? "") as
      | ""
      | "WAITING"
      | "INSPECTION"
      | "IN_PROGRESS"
      | "WAITING_FOR_PARTS"
      | "READY"
      | "COMPLETED",
    inspectionId: String(formData.get("inspectionId") ?? ""),
  };
}

function parseUpdateOrderForm(formData: FormData) {
  return {
    jobCardNumber: String(formData.get("jobCardNumber") ?? ""),
    complaint: String(formData.get("complaint") ?? ""),
    requestedServices: String(formData.get("requestedServices") ?? ""),
    odometerIn: String(formData.get("odometerIn") ?? ""),
    expectedCompletion: String(formData.get("expectedCompletion") ?? ""),
    technicianIds: parseTechnicianIds(formData),
    bay: String(formData.get("bay") ?? ""),
    priority: String(formData.get("priority") ?? "") as
      | ""
      | "LOW"
      | "NORMAL"
      | "HIGH"
      | "URGENT",
    status: String(formData.get("status") ?? "") as
      | ""
      | "WAITING"
      | "INSPECTION"
      | "IN_PROGRESS"
      | "WAITING_FOR_PARTS"
      | "READY"
      | "COMPLETED",
  };
}

/** Create basic job card; client navigates to Labour & parts (`?section=lines`). */
export async function createServiceOrderAction(
  _prev: ServiceOrderActionState,
  formData: FormData,
): Promise<ServiceOrderActionState> {
  const t = await getTranslations("orders");
  try {
    const session = await requireSession();
    const order = await createOrder(session, parseCreateOrderForm(formData));
    revalidatePath("/orders");
    revalidatePath("/workshop");
    revalidatePath("/dashboard");
    revalidatePath("/inspections");
    revalidatePath(`/customers/${order.customerId}`);
    return { ok: true, message: t("created"), orderId: order.id };
  } catch (error) {
    return {
      ok: false,
      message: await translateError(error),
    };
  }
}

export async function updateServiceOrderAction(
  orderId: string,
  _prev: ServiceOrderActionState,
  formData: FormData,
): Promise<ServiceOrderActionState> {
  const t = await getTranslations("orders");
  try {
    const session = await requireSession();
    await updateOrder(session, orderId, parseUpdateOrderForm(formData));
    revalidatePath("/orders");
    revalidatePath("/workshop");
    revalidatePath(`/orders/${orderId}`);
    return { ok: true, message: t("saved") };
  } catch (error) {
    return {
      ok: false,
      message: await translateError(error),
    };
  }
}

export async function changeServiceOrderStatusAction(
  orderId: string,
  _prev: ServiceOrderActionState,
  formData: FormData,
): Promise<ServiceOrderActionState> {
  try {
    const session = await requireSession();
    await changeOrderStatus(session, orderId, {
      status: String(formData.get("status") ?? "") as
        | "WAITING"
        | "INSPECTION"
        | "IN_PROGRESS"
        | "WAITING_FOR_PARTS"
        | "READY"
        | "COMPLETED",
    });
    revalidatePath("/orders");
    revalidatePath("/workshop");
    revalidatePath(`/orders/${orderId}`);
    return { ok: true, message: "statusUpdated" };
  } catch (error) {
    return {
      ok: false,
      message: await translateError(error),
    };
  }
}

/** Board drag/drop and quick-move: same service as the order page status form. */
export async function moveServiceOrderStatusAction(
  orderId: string,
  status: string,
): Promise<ServiceOrderActionState> {
  try {
    const session = await requireSession();
    await changeOrderStatus(session, orderId, {
      status: status as
        | "WAITING"
        | "INSPECTION"
        | "IN_PROGRESS"
        | "WAITING_FOR_PARTS"
        | "READY"
        | "COMPLETED",
    });
    revalidatePath("/orders");
    revalidatePath("/workshop");
    revalidatePath(`/orders/${orderId}`);
    return { ok: true, message: "statusUpdated" };
  } catch (error) {
    return {
      ok: false,
      message: await translateError(error),
    };
  }
}

export async function addServiceOrderLineAction(
  orderId: string,
  _prev: ServiceOrderActionState,
  formData: FormData,
): Promise<ServiceOrderActionState> {
  try {
    const session = await requireSession();
    const gstSplitRaw = String(formData.get("gstSplit") ?? "");
    const gstRateRaw = String(formData.get("gstRatePercent") ?? "");
    const line = await addOrderLine(session, orderId, {
      type: String(formData.get("type") ?? "") as "LABOUR" | "PART" | "OUTSIDE",
      description: String(formData.get("description") ?? ""),
      quantity: String(formData.get("quantity") ?? "1"),
      unitPricePaise: String(formData.get("unitPriceRupees") ?? "0"),
      partId: String(formData.get("partId") ?? ""),
      vendorId: String(formData.get("vendorId") ?? ""),
      gstSplit:
        gstSplitRaw === "IGST" || gstSplitRaw === "CGST_SGST"
          ? gstSplitRaw
          : "",
      gstRatePercent: gstRateRaw,
    });
    revalidatePath(`/orders/${orderId}`);
    return { ok: true, message: "lineAdded", lineId: line.id };
  } catch (error) {
    return {
      ok: false,
      message: await translateError(error),
    };
  }
}

export async function updateServiceOrderLineAction(
  orderId: string,
  lineId: string,
  _prev: ServiceOrderActionState,
  formData: FormData,
): Promise<ServiceOrderActionState> {
  const t = await getTranslations("orders");
  try {
    const session = await requireSession();
    const gstSplitRaw = String(formData.get("gstSplit") ?? "");
    const gstRateRaw = String(formData.get("gstRatePercent") ?? "");
    await updateOrderLine(session, orderId, lineId, {
      description: String(formData.get("description") ?? ""),
      quantity: String(formData.get("quantity") ?? "1"),
      unitPricePaise: String(formData.get("unitPriceRupees") ?? "0"),
      partId: String(formData.get("partId") ?? ""),
      vendorId: String(formData.get("vendorId") ?? ""),
      gstSplit:
        gstSplitRaw === "IGST" || gstSplitRaw === "CGST_SGST"
          ? gstSplitRaw
          : undefined,
      gstRatePercent: gstRateRaw === "" ? undefined : gstRateRaw,
      clearBill: String(formData.get("clearBill") ?? "") === "1",
    });
    revalidatePath(`/orders/${orderId}`);
    return { ok: true, message: t("lineUpdated") };
  } catch (error) {
    return {
      ok: false,
      message: await translateError(error),
    };
  }
}

export async function deleteServiceOrderLineAction(
  orderId: string,
  lineId: string,
): Promise<ServiceOrderActionState> {
  const t = await getTranslations("orders");
  try {
    const session = await requireSession();
    await removeOrderLine(session, orderId, lineId);
    revalidatePath(`/orders/${orderId}`);
    return { ok: true, message: t("lineRemoved") };
  } catch (error) {
    return {
      ok: false,
      message: await translateError(error),
    };
  }
}

export async function deleteServiceOrderAction(
  orderId: string,
  customerId: string,
): Promise<ServiceOrderActionState> {
  const t = await getTranslations("orders");
  try {
    const session = await requireSession();
    await deleteOrder(session, orderId);
    revalidatePath("/orders");
    revalidatePath("/workshop");
    revalidatePath("/dashboard");
    revalidatePath(`/customers/${customerId}`);
    return { ok: true, message: t("deleted") };
  } catch (error) {
    return {
      ok: false,
      message: await translateError(error),
    };
  }
}

function revalidatePaperCopyPaths(
  orderId: string,
  customerId?: string,
  vehicleId?: string,
) {
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  if (customerId) revalidatePath(`/customers/${customerId}`);
  if (vehicleId) revalidatePath(`/vehicles/${vehicleId}`);
}

export async function listPaperCopiesAction(serviceOrderId: string) {
  try {
    const session = await requireSession();
    const copies = await listPaperCopies(session, serviceOrderId);
    return { ok: true as const, copies };
  } catch (error) {
    return {
      ok: false as const,
      message: await translateError(error),
      copies: [] as Awaited<ReturnType<typeof listPaperCopies>>,
    };
  }
}

export async function requestPaperCopyUploadUrlAction(input: {
  serviceOrderId: string;
  contentType: string;
  byteSize: number;
  fileName?: string;
  replacePaperCopyId?: string;
}) {
  try {
    const session = await requireSession();
    return await createPaperCopyUploadUrl(session, input);
  } catch (error) {
    throw new Error(await translateError(error));
  }
}

export async function confirmPaperCopyAction(input: {
  serviceOrderId: string;
  storageKey: string;
  contentType: string;
  byteSize: number;
  fileName?: string;
  customerId?: string;
  vehicleId?: string;
}): Promise<ServiceOrderActionState> {
  const t = await getTranslations("orders");
  try {
    const session = await requireSession();
    await confirmPaperCopyUpload(session, input);
    revalidatePaperCopyPaths(
      input.serviceOrderId,
      input.customerId,
      input.vehicleId,
    );
    return { ok: true, message: t("paperUploaded") };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

export async function replacePaperCopyAction(input: {
  serviceOrderId: string;
  paperCopyId: string;
  storageKey: string;
  contentType: string;
  byteSize: number;
  fileName?: string;
  customerId?: string;
  vehicleId?: string;
}): Promise<ServiceOrderActionState> {
  const t = await getTranslations("orders");
  try {
    const session = await requireSession();
    await replacePaperCopyUpload(session, input);
    revalidatePaperCopyPaths(
      input.serviceOrderId,
      input.customerId,
      input.vehicleId,
    );
    return { ok: true, message: t("paperReplaced") };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

export async function removePaperCopyAction(input: {
  serviceOrderId: string;
  paperCopyId: string;
  customerId?: string;
  vehicleId?: string;
}): Promise<ServiceOrderActionState> {
  const t = await getTranslations("orders");
  try {
    const session = await requireSession();
    await removePaperCopyUpload(session, input);
    revalidatePaperCopyPaths(
      input.serviceOrderId,
      input.customerId,
      input.vehicleId,
    );
    return { ok: true, message: t("paperRemoved") };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

export type SuggestedExpectedCompletionResult =
  | { ok: true; suggestion: SuggestedExpectedCompletion | null }
  | { ok: false; message: string };

export async function getSuggestedExpectedCompletionAction(
  vehicleId: string,
): Promise<SuggestedExpectedCompletionResult> {
  try {
    const session = await requireSession();
    const suggestion = await getSuggestedExpectedCompletionForVehicle(
      session,
      vehicleId,
    );
    return { ok: true, suggestion };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

export async function requestOutsideWorkBillUploadUrlAction(input: {
  serviceOrderId: string;
  lineId: string;
  contentType: string;
  byteSize: number;
  fileName?: string;
}) {
  try {
    const session = await requireSession();
    return await createOutsideWorkBillUploadUrl(session, input);
  } catch (error) {
    throw new Error(await translateError(error));
  }
}

export async function confirmOutsideWorkBillAction(input: {
  serviceOrderId: string;
  lineId: string;
  storageKey: string;
  contentType: string;
  byteSize: number;
  fileName?: string | null;
}): Promise<ServiceOrderActionState> {
  const t = await getTranslations("orders");
  try {
    const session = await requireSession();
    await confirmOutsideWorkBill(session, {
      ...input,
      fileName: input.fileName ?? undefined,
    });
    revalidatePath(`/orders/${input.serviceOrderId}`);
    return {
      ok: true,
      message: t("outsideWorkBillUploaded"),
      orderId: input.serviceOrderId,
      lineId: input.lineId,
    };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

export async function getOutsideWorkBillDownloadUrlAction(
  serviceOrderId: string,
  lineId: string,
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  try {
    const session = await requireSession();
    const url = await getOutsideWorkBillDownloadUrl(
      session,
      serviceOrderId,
      lineId,
    );
    return { ok: true, url };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

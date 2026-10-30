"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { translateError } from "@/lib/translate-error";
import { getTranslations } from "next-intl/server";
import {
  addOrderLine,
  changeOrderStatus,
  createOrder,
  deleteOrder,
  removeOrderLine,
  updateOrder,
  updateOrderLine,
} from "@/modules/service-orders/service";

export type ServiceOrderActionState = {
  ok: boolean;
  message?: string;
  orderId?: string;
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
    inspectionId: String(formData.get("inspectionId") ?? ""),
  };
}

function parseUpdateOrderForm(formData: FormData) {
  return {
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

/** Create basic job card, then the client opens Labour & parts (no hard redirect). */
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
    // Do not revalidate `/orders/[id]` — that remounts the open job card and
    // feels like a full page refresh. Lists still update.
    revalidatePath("/orders");
    revalidatePath("/workshop");
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
    await addOrderLine(session, orderId, {
      type: String(formData.get("type") ?? "") as "LABOUR" | "PART",
      description: String(formData.get("description") ?? ""),
      quantity: String(formData.get("quantity") ?? "1"),
      unitPricePaise: String(formData.get("unitPriceRupees") ?? "0"),
      partId: String(formData.get("partId") ?? ""),
    });
    revalidatePath(`/orders/${orderId}`);
    return { ok: true, message: "lineAdded" };
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
    await updateOrderLine(session, orderId, lineId, {
      description: String(formData.get("description") ?? ""),
      quantity: String(formData.get("quantity") ?? "1"),
      unitPricePaise: String(formData.get("unitPriceRupees") ?? "0"),
      partId: String(formData.get("partId") ?? ""),
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

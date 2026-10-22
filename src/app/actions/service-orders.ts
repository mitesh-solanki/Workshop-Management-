"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppError } from "@/lib/errors";
import { translateError } from "@/lib/translate-error";
import { requireSession } from "@/lib/session";
import {
  addOrderLine,
  changeOrderStatus,
  createOrder,
} from "@/modules/service-orders/service";

export type ServiceOrderActionState = {
  ok: boolean;
  message?: string;
};

export async function createServiceOrderAction(
  _prev: ServiceOrderActionState,
  formData: FormData,
): Promise<ServiceOrderActionState> {
  let orderId: string;
  let customerId: string;
  let vehicleId: string;
  try {
    const session = await requireSession();
    vehicleId = String(formData.get("vehicleId") ?? "");
    const order = await createOrder(session, {
      vehicleId,
      complaint: String(formData.get("complaint") ?? ""),
      requestedServices: String(formData.get("requestedServices") ?? ""),
      odometerIn: String(formData.get("odometerIn") ?? ""),
      expectedCompletion: String(formData.get("expectedCompletion") ?? ""),
      technicianId: String(formData.get("technicianId") ?? ""),
      bay: String(formData.get("bay") ?? ""),
      priority: String(formData.get("priority") ?? "") as
        | ""
        | "LOW"
        | "NORMAL"
        | "HIGH"
        | "URGENT",
    });
    orderId = order.id;
    customerId = order.customerId;
  } catch (error) {
    return {
      ok: false,
      message: error instanceof AppError ? error.message : "Something went wrong",
    };
  }

  revalidatePath("/orders");
  revalidatePath("/workshop");
  revalidatePath(`/customers/${customerId}`);
  revalidatePath(`/vehicles/${vehicleId}/orders/new`);
  redirect(`/orders/${orderId}`);
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
      message: error instanceof AppError ? error.message : "Something went wrong",
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
      message: error instanceof AppError ? error.message : "Something went wrong",
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
    revalidatePath("/inventory");
    revalidatePath("/dashboard");
    return { ok: true, message: "lineAdded" };
  } catch (error) {
    return {
      ok: false,
      message: await translateError(error),
    };
  }
}

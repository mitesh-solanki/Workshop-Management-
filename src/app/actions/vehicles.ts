"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import {
  createVehicleRecord,
  deleteVehicleRecord,
  updateVehicleRecord,
} from "@/modules/vehicles/service";

export type VehicleActionState = {
  ok: boolean;
  message?: string;
};

function vehicleFields(formData: FormData) {
  return {
    registrationNumber: String(formData.get("registrationNumber") ?? ""),
    make: String(formData.get("make") ?? ""),
    model: String(formData.get("model") ?? ""),
    year: String(formData.get("year") ?? ""),
    odometer: String(formData.get("odometer") ?? ""),
    insuranceExpiry: String(formData.get("insuranceExpiry") ?? ""),
    pucExpiry: String(formData.get("pucExpiry") ?? ""),
    fitnessExpiry: String(formData.get("fitnessExpiry") ?? ""),
  };
}

export async function createVehicleAction(
  _prev: VehicleActionState,
  formData: FormData,
): Promise<VehicleActionState> {
  let customerId: string;
  try {
    const session = await requireSession();
    customerId = String(formData.get("customerId") ?? "");
    await createVehicleRecord(session, {
      customerId,
      ...vehicleFields(formData),
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof AppError ? error.message : "Something went wrong",
    };
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  redirect(`/customers/${customerId}`);
}

export async function updateVehicleAction(
  vehicleId: string,
  customerId: string,
  _prev: VehicleActionState,
  formData: FormData,
): Promise<VehicleActionState> {
  try {
    const session = await requireSession();
    await updateVehicleRecord(session, vehicleId, vehicleFields(formData));
    revalidatePath("/customers");
    revalidatePath(`/customers/${customerId}`);
    revalidatePath(`/vehicles/${vehicleId}/edit`);
    return { ok: true, message: "saved" };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof AppError ? error.message : "Something went wrong",
    };
  }
}

export async function deleteVehicleAction(
  vehicleId: string,
  customerId: string,
  _prev: VehicleActionState,
  _formData: FormData,
): Promise<VehicleActionState> {
  try {
    const session = await requireSession();
    await deleteVehicleRecord(session, vehicleId);
  } catch (error) {
    if (error instanceof AppError && error.code === "VEHICLE_HAS_ORDERS") {
      return { ok: false, message: "cannotDeleteHasOrders" };
    }
    return {
      ok: false,
      message: error instanceof AppError ? error.message : "Something went wrong",
    };
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  redirect(`/customers/${customerId}`);
}

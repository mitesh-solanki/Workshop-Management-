"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { translateError } from "@/lib/translate-error";
import { requireSession } from "@/lib/session";
import {
  createVehicleRecord,
  deleteVehicleRecord,
  updateVehicleRecord,
} from "@/modules/vehicles/service";

export type VehicleActionState = {
  ok: boolean;
  message?: string;
  vehicleId?: string;
};

function vehicleFields(formData: FormData) {
  return {
    registrationNumber: String(formData.get("registrationNumber") ?? ""),
    make: String(formData.get("make") ?? ""),
    model: String(formData.get("model") ?? ""),
    stateCode: String(formData.get("stateCode") ?? ""),
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
    return { ok: false, message: await translateError(error) };
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  redirect(`/customers/${customerId}`);
}

/** Modal create — no redirect; client refreshes the customer/vehicle view. */
export async function createVehicleModalAction(
  _prev: VehicleActionState,
  formData: FormData,
): Promise<VehicleActionState> {
  const t = await getTranslations("vehicles");

  try {
    const session = await requireSession();
    const customerId = String(formData.get("customerId") ?? "");
    const vehicle = await createVehicleRecord(session, {
      customerId,
      ...vehicleFields(formData),
    });
    revalidatePath("/customers");
    revalidatePath(`/customers/${customerId}`);
    revalidatePath("/vehicles");
    return {
      ok: true,
      message: t("created"),
      vehicleId: vehicle.id,
    };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

export async function updateVehicleAction(
  vehicleId: string,
  customerId: string,
  _prev: VehicleActionState,
  formData: FormData,
): Promise<VehicleActionState> {
  const t = await getTranslations("vehicles");

  try {
    const session = await requireSession();
    await updateVehicleRecord(session, vehicleId, vehicleFields(formData));
    revalidatePath("/customers");
    revalidatePath(`/customers/${customerId}`);
    revalidatePath("/vehicles");
    revalidatePath(`/vehicles/${vehicleId}`);
    revalidatePath(`/vehicles/${vehicleId}/edit`);
    return { ok: true, message: t("saved") };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

export async function deleteVehicleAction(
  vehicleId: string,
  customerId: string,
  _prev?: VehicleActionState,
  _formData?: FormData,
): Promise<VehicleActionState> {
  try {
    const session = await requireSession();
    await deleteVehicleRecord(session, vehicleId);
    revalidatePath("/customers");
    revalidatePath(`/customers/${customerId}`);
    revalidatePath("/vehicles");
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }

  redirect(`/customers/${customerId}`);
}

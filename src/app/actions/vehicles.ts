"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { getTranslations } from "next-intl/server";
import { AppError } from "@/lib/errors";
import {
  translateError,
  translateZodFieldErrors,
} from "@/lib/translate-error";
import { requireRole } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import {
  createVehicleRecord,
  deleteVehicleRecord,
  listVehicles,
  updateVehicleRecord,
} from "@/modules/vehicles/service";

export type VehiclePickerItem = {
  id: string;
  registrationNumber: string;
  make: string;
  model: string;
  odometer: number | null;
  customerName: string;
};

export async function searchVehiclesPickerAction(
  q: string,
): Promise<{ items: VehiclePickerItem[] }> {
  const session = requireRole(await requireSession(), [
    "OWNER",
    "MANAGER",
    "TECHNICIAN",
  ]);
  const trimmed = q.trim();
  if (trimmed.length < 2) {
    return { items: [] };
  }

  const { items } = await listVehicles(session, {
    q: trimmed,
    pageSize: 20,
    sort: "name_asc",
  });

  return {
    items: items.map((vehicle) => ({
      id: vehicle.id,
      registrationNumber: vehicle.registrationNumber,
      make: vehicle.make,
      model: vehicle.model,
      odometer: vehicle.odometer,
      customerName: vehicle.customer.name,
    })),
  };
}

export type VehicleActionState = {
  ok: boolean;
  message?: string;
  vehicleId?: string;
  fieldErrors?: Record<string, string>;
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

async function vehicleActionError(error: unknown): Promise<VehicleActionState> {
  if (error instanceof ZodError) {
    return {
      ok: false,
      message: await translateError(error),
      fieldErrors: await translateZodFieldErrors(error),
    };
  }
  if (
    error instanceof AppError &&
    error.code === "vehicles.duplicate_registration"
  ) {
    const message = await translateError(error);
    return {
      ok: false,
      message,
      fieldErrors: { registrationNumber: message },
    };
  }
  return { ok: false, message: await translateError(error) };
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
    return vehicleActionError(error);
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
    return vehicleActionError(error);
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
    return vehicleActionError(error);
  }
}

export async function deleteVehicleAction(
  vehicleId: string,
  customerId: string,
  _prev?: VehicleActionState,
  _formData?: FormData,
): Promise<VehicleActionState> {
  const t = await getTranslations("vehicles");

  try {
    const session = await requireSession();
    await deleteVehicleRecord(session, vehicleId);
    revalidatePath("/customers");
    revalidatePath(`/customers/${customerId}`);
    revalidatePath("/vehicles");
    revalidatePath(`/vehicles/${vehicleId}`);
    return { ok: true, message: t("deleted") };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

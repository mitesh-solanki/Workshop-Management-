"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import {
  createCustomerRecord,
  updateCustomerRecord,
} from "@/modules/customers/service";

export type CustomerActionState = {
  ok: boolean;
  message?: string;
};

export async function createCustomerAction(
  _prev: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  let customerId: string;
  try {
    const session = await requireSession();
    const customer = await createCustomerRecord(session, {
      name: String(formData.get("name") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      address: String(formData.get("address") ?? ""),
      notes: String(formData.get("notes") ?? ""),
    });
    customerId = customer.id;
  } catch (error) {
    return {
      ok: false,
      message: error instanceof AppError ? error.message : "Something went wrong",
    };
  }

  revalidatePath("/customers");
  redirect(`/customers/${customerId}`);
}

export async function updateCustomerAction(
  customerId: string,
  _prev: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  try {
    const session = await requireSession();
    await updateCustomerRecord(session, customerId, {
      name: String(formData.get("name") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      address: String(formData.get("address") ?? ""),
      notes: String(formData.get("notes") ?? ""),
    });
    revalidatePath("/customers");
    revalidatePath(`/customers/${customerId}`);
    return { ok: true, message: "saved" };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof AppError ? error.message : "Something went wrong",
    };
  }
}

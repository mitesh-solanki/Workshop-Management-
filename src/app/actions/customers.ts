"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { translateError } from "@/lib/translate-error";
import { requireSession } from "@/lib/session";
import {
  createCustomerRecord,
  deleteCustomerRecord,
  updateCustomerRecord,
} from "@/modules/customers/service";

export type CustomerActionState = {
  ok: boolean;
  message?: string;
  customerId?: string;
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
    return { ok: false, message: await translateError(error) };
  }

  revalidatePath("/customers");
  redirect(`/customers/${customerId}`);
}

/** Modal create — returns id so the client can navigate (no redirect throw). */
export async function createCustomerModalAction(
  _prev: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  const t = await getTranslations("customers");

  try {
    const session = await requireSession();
    const customer = await createCustomerRecord(session, {
      name: String(formData.get("name") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      address: String(formData.get("address") ?? ""),
      notes: String(formData.get("notes") ?? ""),
    });
    revalidatePath("/customers");
    return {
      ok: true,
      message: t("created"),
      customerId: customer.id,
    };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

export async function updateCustomerAction(
  customerId: string,
  _prev: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  const t = await getTranslations("customers");

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
    return { ok: true, message: t("saved") };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

export async function deleteCustomerAction(
  customerId: string,
): Promise<CustomerActionState> {
  const t = await getTranslations("customers");

  try {
    const session = await requireSession();
    await deleteCustomerRecord(session, customerId);
    revalidatePath("/customers");
    return { ok: true, message: t("deleted") };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

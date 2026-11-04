"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { translateError } from "@/lib/translate-error";
import { requireSession } from "@/lib/session";
import {
  createCustomerRecord,
  deleteCustomerRecord,
  listCustomers,
  updateCustomerRecord,
} from "@/modules/customers/service";

export type CustomerActionState = {
  ok: boolean;
  message?: string;
  customerId?: string;
};

export type CustomerPickerItem = {
  id: string;
  name: string;
  phone: string;
};

/** Debounced SearchableSelect picker — matches name or phone. */
export async function searchCustomersPickerAction(
  q: string,
): Promise<{ items: CustomerPickerItem[] }> {
  const session = await requireSession();
  const trimmed = q.trim();
  if (trimmed.length < 2) {
    return { items: [] };
  }

  const { items } = await listCustomers(session, {
    q: trimmed,
    pageSize: 20,
    sort: "name_asc",
  });

  return {
    items: items.map((customer) => ({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
    })),
  };
}

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
      gstin: String(formData.get("gstin") ?? ""),
      stateCode: String(formData.get("stateCode") ?? ""),
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
      gstin: String(formData.get("gstin") ?? ""),
      stateCode: String(formData.get("stateCode") ?? ""),
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
      gstin: String(formData.get("gstin") ?? ""),
      stateCode: String(formData.get("stateCode") ?? ""),
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
  _prev?: CustomerActionState,
  _formData?: FormData,
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

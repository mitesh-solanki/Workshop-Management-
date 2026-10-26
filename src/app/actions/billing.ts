"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { translateError } from "@/lib/translate-error";
import {
  createCreditNote,
  createInvoiceFromApprovedEstimate,
  deleteDraftInvoice,
  finalizeInvoice,
  recordInvoicePayment,
  recordInvoiceRefund,
} from "@/modules/billing/service";
import type {
  CreditNoteReasonValue,
  PaymentMethodValue,
} from "@/modules/billing/schema";

export type BillingActionState = {
  ok: boolean;
  message?: string;
};

function revalidateBilling(orderId: string) {
  revalidatePath(`/orders/${orderId}`);
}

export async function createInvoiceAction(
  orderId: string,
  _prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  try {
    const session = await requireSession();
    const placeRaw = String(formData.get("placeOfSupplyStateCode") ?? "").trim();
    await createInvoiceFromApprovedEstimate(session, orderId, {
      ...(placeRaw.length === 2
        ? { placeOfSupplyStateCode: placeRaw }
        : {}),
      notes: String(formData.get("notes") ?? ""),
      finalize: false,
    });
    revalidateBilling(orderId);
    return { ok: true, message: "draftCreated" };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof AppError
          ? await translateError(error)
          : await translateError(error),
    };
  }
}

export async function finalizeInvoiceAction(
  orderId: string,
  invoiceId: string,
  _prev: BillingActionState,
  _formData: FormData,
): Promise<BillingActionState> {
  try {
    const session = await requireSession();
    await finalizeInvoice(session, { invoiceId });
    revalidateBilling(orderId);
    return { ok: true, message: "invoiceFinalized" };
  } catch (error) {
    return {
      ok: false,
      message: await translateError(error),
    };
  }
}

export async function deleteDraftInvoiceAction(
  orderId: string,
  invoiceId: string,
  _prev: BillingActionState,
  _formData: FormData,
): Promise<BillingActionState> {
  try {
    const session = await requireSession();
    await deleteDraftInvoice(session, { invoiceId });
    revalidateBilling(orderId);
    return { ok: true, message: "draftDeleted" };
  } catch (error) {
    return {
      ok: false,
      message: await translateError(error),
    };
  }
}

export async function remakeDraftInvoiceAction(
  orderId: string,
  invoiceId: string,
  _prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  try {
    const session = await requireSession();
    const placeRaw = String(formData.get("placeOfSupplyStateCode") ?? "").trim();
    const notes = String(formData.get("notes") ?? "");
    await deleteDraftInvoice(session, { invoiceId });
    await createInvoiceFromApprovedEstimate(session, orderId, {
      ...(placeRaw.length === 2
        ? { placeOfSupplyStateCode: placeRaw }
        : {}),
      notes,
      finalize: false,
    });
    revalidateBilling(orderId);
    return { ok: true, message: "draftRemade" };
  } catch (error) {
    return {
      ok: false,
      message: await translateError(error),
    };
  }
}

function paymentBreakdownFromForm(formData: FormData): {
  method: PaymentMethodValue;
  amountPaise: string;
  cashPaise: string;
  upiPaise: string;
  cardPaise: string;
  note: string;
} {
  const method = String(formData.get("method") ?? "CASH") as PaymentMethodValue;
  const amountPaise = String(formData.get("amountRupees") ?? "0");
  const cashPaise = String(formData.get("cashRupees") ?? "");
  const upiPaise = String(formData.get("upiRupees") ?? "");
  const cardPaise = String(formData.get("cardRupees") ?? "");

  if (method === "CASH") {
    return {
      method,
      amountPaise,
      cashPaise: cashPaise || amountPaise,
      upiPaise: "0",
      cardPaise: "0",
      note: String(formData.get("note") ?? ""),
    };
  }
  if (method === "UPI") {
    return {
      method,
      amountPaise,
      cashPaise: "0",
      upiPaise: upiPaise || amountPaise,
      cardPaise: "0",
      note: String(formData.get("note") ?? ""),
    };
  }
  if (method === "CARD") {
    return {
      method,
      amountPaise,
      cashPaise: "0",
      upiPaise: "0",
      cardPaise: cardPaise || amountPaise,
      note: String(formData.get("note") ?? ""),
    };
  }

  return {
    method,
    amountPaise,
    cashPaise,
    upiPaise,
    cardPaise,
    note: String(formData.get("note") ?? ""),
  };
}

export async function recordPaymentAction(
  orderId: string,
  invoiceId: string,
  _prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  try {
    const session = await requireSession();
    const breakdown = paymentBreakdownFromForm(formData);
    await recordInvoicePayment(session, {
      invoiceId,
      ...breakdown,
    });
    revalidateBilling(orderId);
    return { ok: true, message: "paymentRecorded" };
  } catch (error) {
    return {
      ok: false,
      message: await translateError(error),
    };
  }
}

export async function createCreditNoteAction(
  orderId: string,
  invoiceId: string,
  _prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  try {
    const session = await requireSession();
    const descriptions = formData.getAll("description").map(String);
    const quantities = formData.getAll("quantity").map(String);
    const unitPrices = formData.getAll("unitPriceRupees").map(String);
    const gstRates = formData.getAll("gstRatePercent").map(String);
    const hsnCodes = formData.getAll("hsnOrSac").map(String);
    const lines = descriptions.map((description, index) => ({
      description,
      quantity: quantities[index] ?? "1",
      unitPricePaise: unitPrices[index] ?? "0",
      gstRatePercent: gstRates[index] ?? "18",
      hsnOrSac: hsnCodes[index] ?? "",
    }));
    await createCreditNote(session, {
      invoiceId,
      reason: String(formData.get("reason") ?? "CORRECTION") as CreditNoteReasonValue,
      notes: String(formData.get("notes") ?? ""),
      lines,
    });
    revalidateBilling(orderId);
    return { ok: true, message: "creditNoteCreated" };
  } catch (error) {
    return {
      ok: false,
      message: await translateError(error),
    };
  }
}

export async function recordRefundAction(
  orderId: string,
  invoiceId: string,
  _prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  try {
    const session = await requireSession();
    const breakdown = paymentBreakdownFromForm(formData);
    await recordInvoiceRefund(session, {
      invoiceId,
      ...breakdown,
    });
    revalidateBilling(orderId);
    return { ok: true, message: "refundRecorded" };
  } catch (error) {
    return {
      ok: false,
      message: await translateError(error),
    };
  }
}

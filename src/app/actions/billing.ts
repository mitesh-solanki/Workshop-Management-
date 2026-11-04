"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { AppError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { translateError } from "@/lib/translate-error";
import {
  createCreditNote,
  createInvoiceFromApprovedEstimate,
  deleteInvoice,
  deleteInvoicePayment,
  finalizeInvoice,
  recordInvoicePayment,
  recordInvoiceRefund,
  syncInvoiceFromJobCard,
  updateInvoiceLines,
  updateInvoicePayment,
} from "@/modules/billing/service";
import type {
  CreditNoteReasonValue,
  InvoiceLineTypeValue,
  PaymentMethodValue,
} from "@/modules/billing/schema";

export type BillingActionState = {
  ok: boolean;
  message?: string;
  /** Stable AppError.code when the action failed (for client scroll/highlight). */
  code?: string;
  /** Invoice lines after a successful edit (ids for warranty attach). */
  savedLines?: Array<{
    id: string;
    type: string;
    description: string;
    quantity: number;
    unitPricePaise: number;
  }>;
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
      code: error instanceof AppError ? error.code : undefined,
    };
  }
}

export async function deleteDraftInvoiceAction(
  orderId: string,
  invoiceId: string,
  _prev: BillingActionState,
  _formData: FormData,
): Promise<BillingActionState> {
  return deleteInvoiceAction(orderId, invoiceId, _prev, _formData);
}

export async function deleteInvoiceAction(
  orderId: string,
  invoiceId: string,
  _prev: BillingActionState,
  _formData: FormData,
): Promise<BillingActionState> {
  try {
    const session = await requireSession();
    await deleteInvoice(session, { invoiceId });
    revalidateBilling(orderId);
    revalidatePath("/invoices");
    return { ok: true, message: "invoiceDeleted" };
  } catch (error) {
    return {
      ok: false,
      message: await translateError(error),
    };
  }
}

export async function updateInvoiceLinesAction(
  orderId: string,
  invoiceId: string,
  _prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  try {
    const session = await requireSession();
    const types = formData.getAll("type").map(String);
    const descriptions = formData.getAll("description").map(String);
    const quantities = formData.getAll("quantity").map(String);
    const unitPrices = formData.getAll("unitPriceRupees").map(String);
    const ids = formData.getAll("lineId").map(String);
    const partIds = formData.getAll("partId").map(String);
    const lines = descriptions
      .map((description, index) => ({
        id: ids[index] ?? "",
        type: (types[index] ?? "LABOUR") as InvoiceLineTypeValue,
        description,
        quantity: quantities[index] ?? "1",
        unitPricePaise: unitPrices[index] ?? "0",
        partId: partIds[index] ?? "",
      }))
      .filter((line) => line.description.trim().length > 0);
    if (lines.length === 0) {
      const t = await getTranslations("billing");
      return { ok: false, message: t("errors.editNeedItem") };
    }
    const updated = await updateInvoiceLines(session, {
      invoiceId,
      notes: String(formData.get("notes") ?? ""),
      lines,
    });
    revalidateBilling(orderId);
    revalidatePath("/invoices");
    return {
      ok: true,
      message: "invoiceUpdated",
      savedLines: updated.lines.map((line) => ({
        id: line.id,
        type: line.type,
        description: line.description,
        quantity: line.quantity,
        unitPricePaise: line.unitPricePaise,
      })),
    };
  } catch (error) {
    return {
      ok: false,
      message: await translateError(error),
    };
  }
}

export async function syncInvoiceFromJobCardAction(
  orderId: string,
): Promise<BillingActionState> {
  try {
    const session = await requireSession();
    await syncInvoiceFromJobCard(session, { serviceOrderId: orderId });
    revalidateBilling(orderId);
    revalidatePath("/invoices");
    return { ok: true, message: "invoiceSynced" };
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

export async function updatePaymentAction(
  orderId: string,
  invoiceId: string,
  paymentId: string,
  _prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  try {
    const session = await requireSession();
    const breakdown = paymentBreakdownFromForm(formData);
    await updateInvoicePayment(session, {
      invoiceId,
      paymentId,
      ...breakdown,
    });
    revalidateBilling(orderId);
    return { ok: true, message: "paymentUpdated" };
  } catch (error) {
    return {
      ok: false,
      message: await translateError(error),
    };
  }
}

export async function deletePaymentAction(
  orderId: string,
  invoiceId: string,
  paymentId: string,
): Promise<BillingActionState> {
  try {
    const session = await requireSession();
    await deleteInvoicePayment(session, { invoiceId, paymentId });
    revalidateBilling(orderId);
    return { ok: true, message: "paymentDeleted" };
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
    const lines = descriptions
      .map((description, index) => ({
        description,
        quantity: quantities[index] ?? "1",
        unitPricePaise: unitPrices[index] ?? "0",
        gstRatePercent: gstRates[index] ?? "18",
        hsnOrSac: hsnCodes[index] ?? "",
      }))
      .filter((line) => line.description.trim().length > 0);
    if (lines.length === 0) {
      const t = await getTranslations("billing");
      return { ok: false, message: t("errors.creditNoteNeedItem") };
    }
    await createCreditNote(session, {
      invoiceId,
      reason: String(formData.get("reason") ?? "CORRECTION") as CreditNoteReasonValue,
      notes: null,
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

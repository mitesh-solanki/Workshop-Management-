"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { translateError } from "@/lib/translate-error";
import { startUpiPaymentForInvoice } from "@/modules/payments/service";

export type PaymentActionState = {
  ok: boolean;
  message?: string;
  paymentLinkUrl?: string;
  qrImageDataUrl?: string;
  amountPaise?: number;
};

export async function startUpiPaymentAction(
  orderId: string,
  invoiceId: string,
  _prev: PaymentActionState,
  _formData: FormData,
): Promise<PaymentActionState> {
  try {
    const session = await requireSession();
    const payment = await startUpiPaymentForInvoice(session, { invoiceId });
    revalidatePath(`/orders/${orderId}`);
    return {
      ok: true,
      message: "upiReady",
      paymentLinkUrl: payment.paymentLinkUrl ?? undefined,
      qrImageDataUrl: payment.qrImageDataUrl ?? undefined,
      amountPaise: payment.amountPaise,
    };
  } catch (error) {
    console.error("startUpiPaymentAction failed", error);
    if (error instanceof AppError) {
      return { ok: false, message: await translateError(error) };
    }
    return {
      ok: false,
      message: await translateError(
        new AppError("payments.provider_failed"),
      ),
    };
  }
}

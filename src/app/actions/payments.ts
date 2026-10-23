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
    return {
      ok: false,
      message:
        error instanceof AppError
          ? await translateError(error)
          : await translateError(new AppError("errors.not_found")),
    };
  }
}

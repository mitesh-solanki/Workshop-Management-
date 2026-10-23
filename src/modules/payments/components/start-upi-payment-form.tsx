"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatRupees } from "@/lib/money";
import {
  startUpiPaymentAction,
  type PaymentActionState,
} from "@/app/actions/payments";

const initial: PaymentActionState = { ok: false };

type Props = {
  orderId: string;
  invoiceId: string;
  pendingPaise: number;
};

export function StartUpiPaymentForm({
  orderId,
  invoiceId,
  pendingPaise,
}: Props) {
  const t = useTranslations("billing");

  const bound = startUpiPaymentAction.bind(null, orderId, invoiceId);
  const [state, formAction, pending] = useActionState(bound, initial);
  const lastState = useRef<PaymentActionState | null>(null);

  useEffect(() => {
    if (state === lastState.current) return;
    lastState.current = state;
    if (state.ok && state.paymentLinkUrl) {
      toast.success(t("upiReady"));
    } else if (state.message && !state.ok) {
      toast.error(state.message);
    }
  }, [state, t]);

  if (pendingPaise <= 0) {
    return null;
  }

  const link = state.ok ? state.paymentLinkUrl : null;
  const qr = state.ok ? state.qrImageDataUrl : null;
  const amount = state.ok ? (state.amountPaise ?? pendingPaise) : null;

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-4">
      <p className="text-sm font-medium text-slate-800">{t("upiPayTitle")}</p>
      <p className="text-caption text-slate-500">{t("upiPayHint")}</p>

      {!link ? (
        <form action={formAction}>
          <Button type="submit" disabled={pending} className="min-h-11">
            {pending ? t("saving") : t("generateUpi")}
          </Button>
        </form>
      ) : (
        <div className="space-y-3">
          {amount != null ? (
            <p className="text-sm text-slate-700">
              {t("upiAmount", { amount: formatRupees(amount) })}
            </p>
          ) : null}
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qr}
              alt={t("upiQrAlt")}
              className="size-[180px] rounded-md border border-slate-200 bg-white p-2"
            />
          ) : null}
          <Button asChild variant="outline" className="min-h-11">
            <a href={link} target="_blank" rel="noopener noreferrer">
              {t("openUpiLink")}
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}

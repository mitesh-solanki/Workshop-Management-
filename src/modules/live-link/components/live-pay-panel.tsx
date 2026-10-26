"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatRupees } from "@/lib/money";
import {
  liveStartPayAction,
  type LiveLinkActionState,
} from "@/app/actions/live-link";

const initial: LiveLinkActionState = { ok: false };

type Props = {
  token: string;
  invoiceId: string;
  pendingPaise: number;
};

export function LivePayPanel({ token, invoiceId, pendingPaise }: Props) {
  const t = useTranslations("liveLink");

  const bound = liveStartPayAction.bind(null, token, invoiceId);
  const [state, formAction, pending] = useActionState(bound, initial);
  const lastState = useRef<LiveLinkActionState | null>(null);

  useEffect(() => {
    if (state === lastState.current) return;
    lastState.current = state;
    if (state.ok && state.alreadyPaid) {
      toast.success(t("alreadyPaid"));
    } else if (state.ok && state.paymentLinkUrl) {
      toast.success(t("payReady"));
    } else if (state.message && !state.ok) {
      toast.error(state.message);
    }
  }, [state, t]);

  if (pendingPaise <= 0 || state.alreadyPaid) {
    return (
      <p className="text-sm font-medium text-blue-800">{t("alreadyPaid")}</p>
    );
  }

  const link = state.ok ? state.paymentLinkUrl : null;
  const qr = state.ok ? state.qrImageDataUrl : null;
  const amount = state.ok ? (state.amountPaise ?? pendingPaise) : null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        {t("balanceDue")}: {formatRupees(pendingPaise)}
      </p>

      {!link ? (
        <form action={formAction}>
          <Button
            type="submit"
            disabled={pending}
            className="min-h-11 w-full sm:w-auto"
          >
            {pending ? t("saving") : t("payNow")}
          </Button>
        </form>
      ) : (
        <div className="space-y-3 rounded-lg border border-slate-200 p-4">
          {amount != null ? (
            <p className="text-sm font-medium text-slate-900">
              {t("payAmount", { amount: formatRupees(amount) })}
            </p>
          ) : null}
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qr}
              alt={t("qrAlt")}
              className="mx-auto size-[200px] rounded-md border border-slate-200 bg-white p-2"
            />
          ) : null}
          <p className="text-center text-caption text-slate-500">{t("scanQr")}</p>
          <Button asChild className="min-h-11 w-full">
            <a href={link} target="_blank" rel="noopener noreferrer">
              {t("openPaymentLink")}
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}

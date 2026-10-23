"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  finalizeInvoiceAction,
  type BillingActionState,
} from "@/app/actions/billing";

const initial: BillingActionState = { ok: false };

type Props = {
  invoiceId: string;
  orderId: string;
};

export function FinalizeInvoiceForm({ invoiceId, orderId }: Props) {
  const t = useTranslations("billing");
  const bound = finalizeInvoiceAction.bind(null, orderId, invoiceId);
  const [state, formAction, pending] = useActionState(bound, initial);

  return (
    <form action={formAction} className="space-y-2">
      {state.message && !state.ok ? (
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}
      {state.message && state.ok ? (
        <p className="text-sm text-foreground">{t(state.message)}</p>
      ) : null}
      <Button type="submit" disabled={pending} className="min-h-11">
        {pending ? t("saving") : t("finalize")}
      </Button>
    </form>
  );
}

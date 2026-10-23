"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { formatRupees, paiseToRupeesInput, toPaise } from "@/lib/money";
import {
  recordPaymentAction,
  type BillingActionState,
} from "@/app/actions/billing";
import { PAYMENT_METHODS } from "@/modules/billing/schema";

const initial: BillingActionState = { ok: false };

type Props = {
  invoiceId: string;
  orderId: string;
  pendingPaise: number;
};

export function RecordPaymentForm({
  invoiceId,
  orderId,
  pendingPaise,
}: Props) {
  const t = useTranslations("billing");
  const bound = recordPaymentAction.bind(null, orderId, invoiceId);
  const [state, formAction, pending] = useActionState(bound, initial);

  if (pendingPaise <= 0) {
    return (
      <p className="text-sm text-slate-600">{t("fullyPaid")}</p>
    );
  }

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
    >
      <p className="text-sm font-medium text-slate-800">{t("manualPayTitle")}</p>
      <p className="text-caption text-slate-500">{t("manualPayHint")}</p>
      <p className="text-caption text-slate-500">
        {t("pendingBalance")}: {formatRupees(pendingPaise)}
      </p>
      <FormField id="method" label={t("paymentMethod")}>
        <select
          id="method"
          name="method"
          className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
          defaultValue="CASH"
        >
          {PAYMENT_METHODS.map((method) => (
            <option key={method} value={method}>
              {t(`methods.${method}`)}
            </option>
          ))}
        </select>
      </FormField>
      <FormField id="amountRupees" label={t("amount")} hint={t("amountHint")}>
        <input
          id="amountRupees"
          name="amountRupees"
          className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
          defaultValue={paiseToRupeesInput(toPaise(pendingPaise))}
          inputMode="decimal"
        />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField id="cashRupees" label={t("methods.CASH")}>
          <input
            id="cashRupees"
            name="cashRupees"
            className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            inputMode="decimal"
            placeholder="0"
          />
        </FormField>
        <FormField id="upiRupees" label={t("methods.UPI")}>
          <input
            id="upiRupees"
            name="upiRupees"
            className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            inputMode="decimal"
            placeholder="0"
          />
        </FormField>
        <FormField id="cardRupees" label={t("methods.CARD")}>
          <input
            id="cardRupees"
            name="cardRupees"
            className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            inputMode="decimal"
            placeholder="0"
          />
        </FormField>
      </div>
      <p className="text-caption text-slate-500">{t("mixedHint")}</p>
      {state.message && !state.ok ? (
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}
      {state.message && state.ok ? (
        <p className="text-sm text-foreground">{t(state.message)}</p>
      ) : null}
      <Button type="submit" disabled={pending} className="min-h-11">
        {pending ? t("saving") : t("savePayment")}
      </Button>
    </form>
  );
}

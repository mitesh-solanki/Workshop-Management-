"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { formatRupees, paiseToRupeesInput } from "@/lib/money";
import {
  recordRefundAction,
  type BillingActionState,
} from "@/app/actions/billing";
import { PAYMENT_METHODS } from "@/modules/billing/schema";

const initial: BillingActionState = { ok: false };

type Props = {
  invoiceId: string;
  orderId: string;
  refundDuePaise: number;
};

export function RecordRefundForm({
  invoiceId,
  orderId,
  refundDuePaise,
}: Props) {
  const t = useTranslations("billing");
  const bound = recordRefundAction.bind(null, orderId, invoiceId);
  const [state, formAction, pending] = useActionState(bound, initial);

  if (refundDuePaise <= 0) {
    return null;
  }

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-md border border-amber-200 bg-amber-50/60 p-3"
    >
      <p className="text-sm font-medium text-slate-800">{t("recordRefund")}</p>
      <p className="text-caption text-slate-600">
        {t("refundDue")}: {formatRupees(refundDuePaise)}
      </p>
      <p className="text-caption text-slate-500">{t("refundHint")}</p>
      <FormField id="refund-method" label={t("paymentMethod")}>
        <select
          id="refund-method"
          name="method"
          className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
          defaultValue="CASH"
        >
          {PAYMENT_METHODS.filter((method) => method !== "MIXED").map(
            (method) => (
              <option key={method} value={method}>
                {t(`methods.${method}`)}
              </option>
            ),
          )}
          <option value="MIXED">{t("methods.MIXED")}</option>
        </select>
      </FormField>
      <FormField id="refund-amountRupees" label={t("amount")} hint={t("refundAmountHint")}>
        <input
          id="refund-amountRupees"
          name="amountRupees"
          className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
          defaultValue={paiseToRupeesInput(refundDuePaise)}
          inputMode="decimal"
        />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField id="refund-cashRupees" label={t("methods.CASH")}>
          <input
            id="refund-cashRupees"
            name="cashRupees"
            className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            inputMode="decimal"
            placeholder="0"
          />
        </FormField>
        <FormField id="refund-upiRupees" label={t("methods.UPI")}>
          <input
            id="refund-upiRupees"
            name="upiRupees"
            className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            inputMode="decimal"
            placeholder="0"
          />
        </FormField>
        <FormField id="refund-cardRupees" label={t("methods.CARD")}>
          <input
            id="refund-cardRupees"
            name="cardRupees"
            className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            inputMode="decimal"
            placeholder="0"
          />
        </FormField>
      </div>
      {state.message && !state.ok ? (
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}
      {state.message && state.ok ? (
        <p className="text-sm text-foreground">{t(state.message)}</p>
      ) : null}
      <Button type="submit" disabled={pending} className="min-h-11">
        {pending ? t("saving") : t("saveRefund")}
      </Button>
    </form>
  );
}

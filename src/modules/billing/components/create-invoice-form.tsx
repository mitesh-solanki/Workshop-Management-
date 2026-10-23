"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { GST_STATE_CODES } from "@/lib/gstin";
import {
  createInvoiceAction,
  type BillingActionState,
} from "@/app/actions/billing";

const initial: BillingActionState = { ok: false };

type Props = {
  orderId: string;
  defaultPlaceOfSupplyStateCode: string;
};

export function CreateInvoiceForm({
  orderId,
  defaultPlaceOfSupplyStateCode,
}: Props) {
  const t = useTranslations("billing");
  const tGst = useTranslations("gst");
  const bound = createInvoiceAction.bind(null, orderId);
  const [state, formAction, pending] = useActionState(bound, initial);
  const defaultCode = GST_STATE_CODES.includes(
    defaultPlaceOfSupplyStateCode as (typeof GST_STATE_CODES)[number],
  )
    ? defaultPlaceOfSupplyStateCode
    : "24";

  return (
    <form action={formAction} className="space-y-3">
      <FormField
        id="placeOfSupplyStateCode"
        label={t("placeOfSupply")}
        hint={t("placeOfSupplyHint")}
      >
        <select
          id="placeOfSupplyStateCode"
          name="placeOfSupplyStateCode"
          defaultValue={defaultCode}
          className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          {GST_STATE_CODES.map((code) => (
            <option key={code} value={code}>
              {tGst(`states.${code}`)} ({code})
            </option>
          ))}
        </select>
      </FormField>
      <FormField id="notes" label={t("notes")}>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder={t("notesPlaceholder")}
        />
      </FormField>
      <label className="flex min-h-11 items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="finalize"
          value="true"
          defaultChecked
          className="size-4"
        />
        {t("finalizeOnCreate")}
      </label>
      {state.message && !state.ok ? (
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}
      {state.message && state.ok ? (
        <p className="text-sm text-foreground">{t(state.message)}</p>
      ) : null}
      <Button type="submit" disabled={pending} className="min-h-11">
        {pending ? t("saving") : t("createInvoice")}
      </Button>
    </form>
  );
}

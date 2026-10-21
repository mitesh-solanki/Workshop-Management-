"use client";

import { useActionState, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  addEstimateLineAction,
  type EstimateActionState,
} from "@/app/actions/estimates";
import { RupeePriceInput } from "@/components/rupee-price-input";
import {
  DEFAULT_GST_RATE_PERCENT,
  DEFAULT_LABOUR_SAC,
  GST_RATE_OPTIONS,
} from "@/modules/estimates/schema";

const initial: EstimateActionState = { ok: false };

const inputClass =
  "min-h-12 w-full rounded-md border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring";

type Props = {
  orderId: string;
};

export function EstimateLineForm({ orderId }: Props) {
  const t = useTranslations("estimates");
  const bound = useMemo(
    () => addEstimateLineAction.bind(null, orderId),
    [orderId],
  );
  const [state, formAction, pending] = useActionState(bound, initial);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="type" className="text-sm font-medium">
            {t("lineType")}
          </label>
          <select
            id="type"
            name="type"
            required
            className={inputClass}
            defaultValue="LABOUR"
          >
            <option value="LABOUR">{t("lineTypes.LABOUR")}</option>
            <option value="PART">{t("lineTypes.PART")}</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="quantity" className="text-sm font-medium">
            {t("quantity")}
          </label>
          <input
            id="quantity"
            name="quantity"
            type="number"
            inputMode="numeric"
            min={1}
            defaultValue={1}
            required
            className={inputClass}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-sm font-medium">
          {t("lineDescription")}
        </label>
        <input
          id="description"
          name="description"
          required
          maxLength={500}
          className={inputClass}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <RupeePriceInput label={t("unitPrice")} hint={t("unitPriceHint")} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="gstRatePercent" className="text-sm font-medium">
            {t("gstRate")}
          </label>
          <select
            id="gstRatePercent"
            name="gstRatePercent"
            required
            className={inputClass}
            defaultValue={String(DEFAULT_GST_RATE_PERCENT)}
          >
            {GST_RATE_OPTIONS.map((rate) => (
              <option key={rate} value={rate}>
                {rate}%
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="hsnOrSac" className="text-sm font-medium">
            {t("hsnOrSac")}
          </label>
          <input
            id="hsnOrSac"
            name="hsnOrSac"
            required
            maxLength={16}
            defaultValue={DEFAULT_LABOUR_SAC}
            className={inputClass}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t("hsnOrSacHint")}</p>
      {state.message && (
        <p
          className={
            state.ok ? "text-sm text-foreground" : "text-sm text-destructive"
          }
          role="status"
        >
          {state.ok ? t("lineAdded") : state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 rounded-md border px-4 text-base font-medium disabled:opacity-60"
      >
        {pending ? t("saving") : t("addLine")}
      </button>
    </form>
  );
}

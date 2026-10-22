"use client";

import { useActionState, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  addEstimateLineAction,
  type EstimateActionState,
} from "@/app/actions/estimates";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { RupeePriceInput } from "@/components/rupee-price-input";
import {
  DEFAULT_GST_RATE_PERCENT,
  DEFAULT_LABOUR_SAC,
  GST_RATE_OPTIONS,
} from "@/modules/estimates/schema";

const initial: EstimateActionState = { ok: false };

const selectClass =
  "h-9 min-h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/40";

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
    <form
      action={formAction}
      className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
        <FormField id="type" label={t("lineType")} className="sm:col-span-1">
          <select
            id="type"
            name="type"
            required
            className={selectClass}
            defaultValue="LABOUR"
          >
            <option value="LABOUR">{t("lineTypes.LABOUR")}</option>
            <option value="PART">{t("lineTypes.PART")}</option>
          </select>
        </FormField>
        <FormField id="quantity" label={t("quantity")} className="sm:col-span-1">
          <Input
            id="quantity"
            name="quantity"
            type="number"
            inputMode="numeric"
            min={1}
            defaultValue={1}
            required
            className="h-9 min-h-9"
          />
        </FormField>
        <FormField
          id="description"
          label={t("lineDescription")}
          className="sm:col-span-4"
        >
          <Input
            id="description"
            name="description"
            required
            maxLength={500}
            className="h-9 min-h-9"
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-6 sm:items-end">
        <RupeePriceInput
          label={t("unitPrice")}
          hint=""
          inputClassName="h-9 min-h-9"
          className="sm:col-span-2"
        />
        <FormField
          id="gstRatePercent"
          label={t("gstRate")}
          className="sm:col-span-1"
        >
          <select
            id="gstRatePercent"
            name="gstRatePercent"
            required
            className={selectClass}
            defaultValue={String(DEFAULT_GST_RATE_PERCENT)}
          >
            {GST_RATE_OPTIONS.map((rate) => (
              <option key={rate} value={rate}>
                {rate}%
              </option>
            ))}
          </select>
        </FormField>
        <FormField id="hsnOrSac" label={t("hsnOrSac")} className="sm:col-span-2">
          <Input
            id="hsnOrSac"
            name="hsnOrSac"
            required
            maxLength={16}
            defaultValue={DEFAULT_LABOUR_SAC}
            className="h-9 min-h-9"
          />
        </FormField>
        <div className="flex sm:col-span-1 sm:items-end">
          <Button
            type="submit"
            size="sm"
            loading={pending}
            className="h-9 min-h-9 w-full"
          >
            {pending ? t("saving") : t("addLine")}
          </Button>
        </div>
      </div>

      <p className="text-caption text-slate-500">{t("unitPriceHint")}</p>

      {state.message && !state.ok ? (
        <p className="text-xs text-danger" role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

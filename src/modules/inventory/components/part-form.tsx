"use client";

import { useActionState, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  createPartAction,
  updatePartAction,
  type InventoryActionState,
} from "@/app/actions/inventory";
import { RupeePriceInput } from "@/components/rupee-price-input";
import {
  DEFAULT_GST_RATE_PERCENT,
  DEFAULT_PART_HSN,
  GST_RATE_OPTIONS,
  PART_UNIT_OPTIONS,
} from "@/modules/inventory/schema";

const initial: InventoryActionState = { ok: false };

const inputClass =
  "min-h-12 w-full rounded-md border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring";

type PartValues = {
  name: string;
  sku: string;
  unit: string;
  purchasePricePaise: number;
  sellingPricePaise: number;
  gstRatePercent: number;
  hsn: string;
  lowStockLevel: number;
};

type Props =
  | { mode: "create" }
  | { mode: "edit"; partId: string; part: PartValues };

export function PartForm(props: Props) {
  const t = useTranslations("inventory");
  const boundUpdate = useMemo(() => {
    if (props.mode !== "edit") {
      return null;
    }
    return updatePartAction.bind(null, props.partId);
  }, [props]);

  const [state, formAction, pending] = useActionState(
    props.mode === "create" ? createPartAction : boundUpdate!,
    initial,
  );

  const defaults: PartValues =
    props.mode === "edit"
      ? props.part
      : {
          name: "",
          sku: "",
          unit: "pcs",
          purchasePricePaise: 0,
          sellingPricePaise: 0,
          gstRatePercent: DEFAULT_GST_RATE_PERCENT,
          hsn: DEFAULT_PART_HSN,
          lowStockLevel: 0,
        };

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-medium">
          {t("name")}
        </label>
        <input
          id="name"
          name="name"
          defaultValue={defaults.name}
          required
          maxLength={200}
          className={inputClass}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="sku" className="text-sm font-medium">
            {t("sku")}
          </label>
          <input
            id="sku"
            name="sku"
            defaultValue={defaults.sku}
            required
            maxLength={64}
            className={`${inputClass} font-mono uppercase`}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="unit" className="text-sm font-medium">
            {t("unit")}
          </label>
          <select
            id="unit"
            name="unit"
            defaultValue={defaults.unit}
            required
            className={inputClass}
          >
            {PART_UNIT_OPTIONS.map((unit) => (
              <option key={unit} value={unit}>
                {t(`units.${unit}`)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <RupeePriceInput
          id="purchasePriceRupees"
          name="purchasePriceRupees"
          label={t("purchasePrice")}
          hint={t("priceHint")}
          defaultPaise={defaults.purchasePricePaise}
        />
        <RupeePriceInput
          id="sellingPriceRupees"
          name="sellingPriceRupees"
          label={t("sellingPrice")}
          hint={t("priceHint")}
          defaultPaise={defaults.sellingPricePaise}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="gstRatePercent" className="text-sm font-medium">
            {t("gstRate")}
          </label>
          <select
            id="gstRatePercent"
            name="gstRatePercent"
            defaultValue={String(defaults.gstRatePercent)}
            className={inputClass}
          >
            {GST_RATE_OPTIONS.map((rate) => (
              <option key={rate} value={rate}>
                {rate}%
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="hsn" className="text-sm font-medium">
            {t("hsn")}
          </label>
          <input
            id="hsn"
            name="hsn"
            defaultValue={defaults.hsn}
            required
            maxLength={16}
            className={`${inputClass} font-mono`}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="lowStockLevel" className="text-sm font-medium">
            {t("lowStockLevel")}
          </label>
          <input
            id="lowStockLevel"
            name="lowStockLevel"
            type="number"
            inputMode="numeric"
            min={0}
            defaultValue={defaults.lowStockLevel}
            required
            className={inputClass}
          />
        </div>
        {props.mode === "create" ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="openingStock" className="text-sm font-medium">
              {t("openingStock")}
            </label>
            <input
              id="openingStock"
              name="openingStock"
              type="number"
              inputMode="numeric"
              min={0}
              defaultValue={0}
              className={inputClass}
            />
            <p className="text-xs text-muted-foreground">{t("openingStockHint")}</p>
          </div>
        ) : null}
      </div>
      {state.message ? (
        <p
          className={
            state.ok ? "text-sm text-foreground" : "text-sm text-destructive"
          }
          role="status"
        >
          {state.ok ? t("saved") : state.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 rounded-md bg-primary px-4 text-base font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending
          ? t("saving")
          : props.mode === "create"
            ? t("create")
            : t("save")}
      </button>
    </form>
  );
}

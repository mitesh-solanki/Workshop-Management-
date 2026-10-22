"use client";

import { useActionState, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  addServiceOrderLineAction,
  type ServiceOrderActionState,
} from "@/app/actions/service-orders";
import { RupeePriceInput } from "@/components/rupee-price-input";

const initial: ServiceOrderActionState = { ok: false };

const inputClass =
  "min-h-12 w-full rounded-md border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring";

export type OrderLinePartOption = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  sellingPricePaise: number;
  quantityOnHand: number;
};

type Props = {
  orderId: string;
  parts: OrderLinePartOption[];
};

export function OrderLineForm({ orderId, parts }: Props) {
  const t = useTranslations("orders");
  const ti = useTranslations("inventory");
  const bound = useMemo(
    () => addServiceOrderLineAction.bind(null, orderId),
    [orderId],
  );
  const [state, formAction, pending] = useActionState(bound, initial);
  const [lineType, setLineType] = useState<"LABOUR" | "PART">("LABOUR");
  const [partId, setPartId] = useState(parts[0]?.id ?? "");
  const selected = useMemo(
    () => parts.find((p) => p.id === partId) ?? null,
    [parts, partId],
  );

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
            value={lineType}
            onChange={(e) =>
              setLineType(e.target.value === "PART" ? "PART" : "LABOUR")
            }
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

      {lineType === "PART" ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="partId" className="text-sm font-medium">
            {ti("part")}
          </label>
          {parts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{ti("noPartsForSale")}</p>
          ) : (
            <>
              <select
                id="partId"
                name="partId"
                required
                value={partId}
                onChange={(e) => setPartId(e.target.value)}
                className={inputClass}
              >
                {parts.map((part) => (
                  <option key={part.id} value={part.id}>
                    {part.name} ({part.sku}) · {part.quantityOnHand} {part.unit}
                  </option>
                ))}
              </select>
              <input
                type="hidden"
                name="description"
                value={selected ? `${selected.name} (${selected.sku})` : ""}
              />
            </>
          )}
        </div>
      ) : (
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
          <input type="hidden" name="partId" value="" />
        </div>
      )}

      <RupeePriceInput
        label={t("unitPrice")}
        hint={t("unitPriceHint")}
        defaultPaise={
          lineType === "PART" ? (selected?.sellingPricePaise ?? 0) : 0
        }
        key={`${lineType}-${selected?.id ?? "labour"}`}
      />
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
        disabled={pending || (lineType === "PART" && parts.length === 0)}
        className="min-h-12 rounded-md border px-4 text-base font-medium disabled:opacity-60"
      >
        {pending ? t("saving") : t("addLine")}
      </button>
    </form>
  );
}

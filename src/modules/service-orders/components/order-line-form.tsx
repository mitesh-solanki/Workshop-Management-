"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  addServiceOrderLineAction,
  type ServiceOrderActionState,
} from "@/app/actions/service-orders";
import { RupeePriceInput } from "@/components/rupee-price-input";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { QuantityStepper } from "@/modules/inventory/components/quantity-stepper";

const initial: ServiceOrderActionState = { ok: false };

const fieldControlClass =
  "h-11 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-[14px] shadow-xs outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/25";

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
  const handledMessage = useRef<string | null>(null);
  const [lineType, setLineType] = useState<"LABOUR" | "PART">("LABOUR");
  const [partId, setPartId] = useState(parts[0]?.id ?? "");
  const selected = useMemo(
    () => parts.find((p) => p.id === partId) ?? null,
    [parts, partId],
  );

  useEffect(() => {
    if (!state.message || state.message === handledMessage.current) return;
    handledMessage.current = state.message;
    if (state.ok) {
      toast.success(t("lineAdded"));
    } else {
      toast.error(state.message);
    }
  }, [state, t]);

  return (
    <form action={formAction}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-end sm:gap-3">
        <FormField id="type" label={t("lineType")} className="sm:col-span-2">
          <select
            id="type"
            name="type"
            required
            className={fieldControlClass}
            value={lineType}
            onChange={(e) =>
              setLineType(e.target.value === "PART" ? "PART" : "LABOUR")
            }
          >
            <option value="LABOUR">{t("lineTypes.LABOUR")}</option>
            <option value="PART">{t("lineTypes.PART")}</option>
          </select>
        </FormField>

        {lineType === "PART" ? (
          <FormField id="partId" label={ti("part")} className="sm:col-span-5">
            {parts.length === 0 ? (
              <p className="flex h-11 items-center text-[14px] text-muted-foreground">
                {ti("noPartsForSale")}
              </p>
            ) : (
              <>
                <select
                  id="partId"
                  name="partId"
                  required
                  value={partId}
                  onChange={(e) => setPartId(e.target.value)}
                  className={fieldControlClass}
                >
                  {parts.map((part) => (
                    <option key={part.id} value={part.id}>
                      {part.name} ({part.sku}) · {part.quantityOnHand}{" "}
                      {part.unit}
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
          </FormField>
        ) : (
          <FormField
            id="description"
            label={t("lineDescription")}
            className="sm:col-span-5"
          >
            <Input
              id="description"
              name="description"
              required
              maxLength={500}
              placeholder={t("lineDescriptionPlaceholder")}
              className={fieldControlClass}
            />
            <input type="hidden" name="partId" value="" />
          </FormField>
        )}

        <QuantityStepper
          id="quantity"
          name="quantity"
          label={t("quantity")}
          defaultValue={1}
          min={1}
          className="sm:col-span-2"
        />

        <RupeePriceInput
          label={t("unitPrice")}
          hint=""
          defaultPaise={
            lineType === "PART" ? (selected?.sellingPricePaise ?? 0) : 0
          }
          key={`${lineType}-${selected?.id ?? "labour"}`}
          className="sm:col-span-2"
          inputClassName="h-11 min-h-11 rounded-lg border-slate-300 text-[14px] shadow-xs focus-visible:border-blue-600 focus-visible:ring-blue-600/25"
        />

        <div className="flex sm:col-span-1 sm:justify-end">
          <Button
            type="submit"
            size="icon"
            loading={pending}
            disabled={lineType === "PART" && parts.length === 0}
            aria-label={t("addLineItem")}
            title={t("addLineItem")}
            className="size-11 min-h-11 min-w-11 border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800"
          >
            <Plus className="size-5" strokeWidth={2.5} />
          </Button>
        </div>
      </div>
    </form>
  );
}

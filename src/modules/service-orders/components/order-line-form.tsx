"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
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

const initial: ServiceOrderActionState = { ok: false };

const selectClass =
  "h-11 min-h-11 w-full rounded-md border border-input bg-transparent px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/40 md:text-sm";

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
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField id="type" label={t("lineType")}>
          <select
            id="type"
            name="type"
            required
            className={selectClass}
            value={lineType}
            onChange={(e) =>
              setLineType(e.target.value === "PART" ? "PART" : "LABOUR")
            }
          >
            <option value="LABOUR">{t("lineTypes.LABOUR")}</option>
            <option value="PART">{t("lineTypes.PART")}</option>
          </select>
        </FormField>
        <FormField id="quantity" label={t("quantity")}>
          <Input
            id="quantity"
            name="quantity"
            type="number"
            inputMode="numeric"
            min={1}
            defaultValue={1}
            required
            className="h-11 min-h-11"
          />
        </FormField>
      </div>

      {lineType === "PART" ? (
        <FormField id="partId" label={ti("part")}>
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
                className={selectClass}
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
        </FormField>
      ) : (
        <FormField id="description" label={t("lineDescription")}>
          <Input
            id="description"
            name="description"
            required
            maxLength={500}
            className="h-11 min-h-11"
          />
          <input type="hidden" name="partId" value="" />
        </FormField>
      )}

      <RupeePriceInput
        label={t("unitPrice")}
        hint={t("unitPriceHint")}
        defaultPaise={
          lineType === "PART" ? (selected?.sellingPricePaise ?? 0) : 0
        }
        key={`${lineType}-${selected?.id ?? "labour"}`}
      />
      <Button
        type="submit"
        size="md"
        loading={pending}
        disabled={lineType === "PART" && parts.length === 0}
      >
        {pending ? t("saving") : t("addLine")}
      </Button>
    </form>
  );
}

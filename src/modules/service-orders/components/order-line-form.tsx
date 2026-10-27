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
import { FormSelect } from "@/components/ui/form-select";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import {
  PartPickerSelect,
  type PartPickerItem,
} from "@/modules/inventory/components/part-picker-select";
import { QuantityStepper } from "@/modules/inventory/components/quantity-stepper";

const initial: ServiceOrderActionState = { ok: false };

const fieldControlClass =
  "h-11 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-[14px] shadow-xs outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/25";

type Props = {
  orderId: string;
};

export function OrderLineForm({ orderId }: Props) {
  const t = useTranslations("orders");
  const ti = useTranslations("inventory");
  const bound = useMemo(
    () => addServiceOrderLineAction.bind(null, orderId),
    [orderId],
  );
  const [state, formAction, pending] = useActionState(bound, initial);
  const handledMessage = useRef<string | null>(null);
  const [lineType, setLineType] = useState<"LABOUR" | "PART">("LABOUR");
  const [partId, setPartId] = useState("");
  const [selected, setSelected] = useState<PartPickerItem | null>(null);

  useEffect(() => {
    if (!state.message || state.message === handledMessage.current) return;
    handledMessage.current = state.message;
    if (state.ok) {
      toast.success(t("lineAdded"));
      setPartId("");
      setSelected(null);
    } else {
      toast.error(state.message);
    }
  }, [state, t]);

  return (
    <form action={formAction}>
      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-[8rem_minmax(0,1fr)_9rem_9.5rem_auto] lg:gap-3">
        <FormField id="type" label={t("lineType")}>
          <FormSelect
            id="type"
            name="type"
            required
            value={lineType}
            onValueChange={(value) =>
              setLineType(value === "PART" ? "PART" : "LABOUR")
            }
            options={[
              { value: "LABOUR", label: t("lineTypes.LABOUR") },
              { value: "PART", label: t("lineTypes.PART") },
            ]}
            triggerClassName={fieldControlClass}
          />
        </FormField>

        {lineType === "PART" ? (
          <FormField id="partId" label={ti("part")} className="sm:col-span-2 lg:col-span-1">
            <PartPickerSelect
              id="partId"
              name="partId"
              value={partId}
              onChange={(nextId, part) => {
                setPartId(nextId);
                setSelected(part);
              }}
            />
            <input
              type="hidden"
              name="description"
              value={selected ? `${selected.name} (${selected.sku})` : ""}
            />
          </FormField>
        ) : (
          <FormField
            id="description"
            label={t("lineDescription")}
            className="sm:col-span-2 lg:col-span-1"
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
        />

        <RupeePriceInput
          label={t("unitPrice")}
          hint=""
          defaultPaise={
            lineType === "PART" ? (selected?.sellingPricePaise ?? 0) : 0
          }
          key={`${lineType}-${selected?.id ?? "labour"}`}
          inputClassName="h-11 min-h-11 rounded-lg border-slate-300 text-[14px] shadow-xs focus-visible:border-blue-600 focus-visible:ring-blue-600/25"
        />

        <Button
          type="submit"
          variant="primary"
          size="md"
          loading={pending}
          disabled={lineType === "PART" && !partId}
          className="h-11 min-h-11 gap-1.5 px-4"
        >
          <Plus className="size-4" strokeWidth={2.5} />
          {t("addLineAction")}
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  addEstimateLineAction,
  type EstimateActionState,
} from "@/app/actions/estimates";
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
import {
  DEFAULT_GST_RATE_PERCENT,
  DEFAULT_LABOUR_SAC,
  DEFAULT_PART_HSN,
} from "@/modules/estimates/schema";

const initial: EstimateActionState = { ok: false };

const fieldControlClass =
  "h-11 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-[14px] shadow-xs outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/25";

type Props = {
  orderId: string;
};

export function EstimateLineForm({ orderId }: Props) {
  const t = useTranslations("estimates");
  const to = useTranslations("orders");
  const ti = useTranslations("inventory");
  const bound = useMemo(
    () => addEstimateLineAction.bind(null, orderId),
    [orderId],
  );
  const [state, formAction, pending] = useActionState(bound, initial);
  const handledMessage = useRef<string | null>(null);
  const [lineType, setLineType] = useState<"LABOUR" | "PART">("LABOUR");
  const [partId, setPartId] = useState("");
  const [selectedPart, setSelectedPart] = useState<PartPickerItem | null>(null);

  useEffect(() => {
    if (!state.message || state.message === handledMessage.current) return;
    handledMessage.current = state.message;
    if (state.ok) {
      toast.success(
        state.message === "lineAdded" ? t("lineAdded") : state.message,
      );
      setPartId("");
      setSelectedPart(null);
    } else {
      toast.error(state.message);
    }
  }, [state, t]);

  return (
    <section className="overflow-hidden rounded-[13px] border border-[#cfdcf1] bg-white shadow-[0_3px_17px_rgba(36,58,99,0.04)]">
      <div className="flex items-center gap-3 border-b border-[#d8e4f5] bg-[#f4f8ff] px-4 py-4">
        <span className="grid size-[30px] shrink-0 place-items-center rounded-lg bg-[#dfeaff] text-blue-700">
          <Plus className="size-5" strokeWidth={2.5} aria-hidden />
        </span>
        <div className="min-w-0">
          <strong className="block text-[14px] font-semibold text-slate-900">
            {t("addAnotherServiceTitle")}
          </strong>
          <small className="mt-0.5 block text-[13px] text-slate-500">
            {t("addLineCollapsedHint")}
          </small>
        </div>
      </div>

      <form action={formAction} className="space-y-3 bg-[#fafcff] px-4 py-4 sm:px-5">
        <input type="hidden" name="type" value={lineType} />
        <input
          type="hidden"
          name="hsnOrSac"
          value={lineType === "PART" ? DEFAULT_PART_HSN : DEFAULT_LABOUR_SAC}
        />
        <input
          type="hidden"
          name="gstRatePercent"
          value={String(DEFAULT_GST_RATE_PERCENT)}
        />

        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-[8rem_minmax(0,1fr)_9rem_9.5rem_auto] lg:gap-3">
          <FormField id="est-line-type" label={t("lineType")}>
            <FormSelect
              id="est-line-type"
              value={lineType}
              onValueChange={(value) => {
                setLineType(value === "PART" ? "PART" : "LABOUR");
                setPartId("");
                setSelectedPart(null);
              }}
              options={[
                { value: "LABOUR", label: t("lineTypes.LABOUR") },
                { value: "PART", label: t("lineTypes.PART") },
              ]}
              triggerClassName={fieldControlClass}
            />
          </FormField>

          {lineType === "PART" ? (
            <FormField
              id="est-line-part"
              label={ti("part")}
              className="sm:col-span-2 lg:col-span-1"
            >
              <PartPickerSelect
                id="est-line-part"
                value={partId}
                onChange={(nextId, part) => {
                  setPartId(nextId);
                  setSelectedPart(part);
                }}
              />
              <input
                type="hidden"
                name="description"
                value={
                  selectedPart
                    ? `${selectedPart.name} (${selectedPart.sku})`
                    : ""
                }
              />
            </FormField>
          ) : (
            <FormField
              id="est-line-desc"
              label={t("workOrPartNeeded")}
              className="sm:col-span-2 lg:col-span-1"
            >
              <Input
                id="est-line-desc"
                name="description"
                required
                maxLength={500}
                placeholder={t("workOrPartPlaceholder")}
                className={fieldControlClass}
              />
            </FormField>
          )}

          <QuantityStepper
            id="est-line-qty"
            name="quantity"
            label={t("quantity")}
            defaultValue={1}
            min={1}
          />

          <RupeePriceInput
            id="est-line-price"
            label={t("priceEach")}
            hint=""
            defaultPaise={
              lineType === "PART"
                ? (selectedPart?.sellingPricePaise ?? 0)
                : 0
            }
            key={`${lineType}-${selectedPart?.id ?? "labour"}`}
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
            {to("addLineAction")}
          </Button>
        </div>

        <p className="text-[13px] text-slate-500">{t("newWorkWaitingHint")}</p>

        {state.message && !state.ok ? (
          <p className="text-[13px] text-danger" role="status">
            {state.message}
          </p>
        ) : null}
      </form>
    </section>
  );
}

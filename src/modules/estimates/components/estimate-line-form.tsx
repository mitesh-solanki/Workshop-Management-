"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  addEstimateLineAction,
  type EstimateActionState,
} from "@/app/actions/estimates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import {
  DEFAULT_GST_RATE_PERCENT,
  DEFAULT_LABOUR_SAC,
  DEFAULT_PART_HSN,
  GST_RATE_OPTIONS,
} from "@/modules/estimates/schema";
import { cn } from "@/lib/utils";

const initial: EstimateActionState = { ok: false };

const controlClass =
  "h-11 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-[14px] shadow-xs outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/25";

const labelClass = "mb-1.5 block text-[13px] font-bold text-slate-700";

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
  const handledMessage = useRef<string | null>(null);
  const [lineType, setLineType] = useState<"LABOUR" | "PART">("LABOUR");

  useEffect(() => {
    if (!state.message || state.message === handledMessage.current) return;
    handledMessage.current = state.message;
    if (state.ok) {
      toast.success(
        state.message === "lineAdded" ? t("lineAdded") : state.message,
      );
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

      <form action={formAction} className="space-y-4 bg-[#fafcff] px-4 py-4 sm:px-5">
        <input type="hidden" name="type" value={lineType} />
        <input
          type="hidden"
          name="hsnOrSac"
          value={lineType === "PART" ? DEFAULT_PART_HSN : DEFAULT_LABOUR_SAC}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
          <div className="min-w-0 sm:col-span-2">
            <label htmlFor="est-line-type" className={labelClass}>
              {t("lineType")}
            </label>
            <select
              id="est-line-type"
              className={controlClass}
              value={lineType}
              onChange={(e) =>
                setLineType(e.target.value === "PART" ? "PART" : "LABOUR")
              }
            >
              <option value="LABOUR">{t("lineTypes.LABOUR")}</option>
              <option value="PART">{t("lineTypes.PART")}</option>
            </select>
          </div>
          <div className="min-w-0 sm:col-span-5">
            <label htmlFor="est-line-desc" className={labelClass}>
              {t("workOrPartNeeded")}
            </label>
            <Input
              id="est-line-desc"
              name="description"
              required
              maxLength={500}
              placeholder={t("workOrPartPlaceholder")}
              className={controlClass}
            />
          </div>
          <div className="min-w-0 sm:col-span-2">
            <label htmlFor="est-line-qty" className={labelClass}>
              {t("quantity")}
            </label>
            <Input
              id="est-line-qty"
              name="quantity"
              type="number"
              inputMode="numeric"
              min={1}
              defaultValue={1}
              required
              className={controlClass}
            />
          </div>
          <div className="min-w-0 sm:col-span-3">
            <label htmlFor="est-line-price" className={labelClass}>
              {t("priceEach")}
            </label>
            <Input
              id="est-line-price"
              name="unitPriceRupees"
              type="text"
              inputMode="decimal"
              required
              defaultValue=""
              placeholder="0"
              className={cn(controlClass, "tabular-nums")}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-end">
          <div className="min-w-0 sm:col-span-8">
            <label htmlFor="est-line-why" className={labelClass}>
              {t("whyNeeded")}
            </label>
            <Input
              id="est-line-why"
              name="reason"
              maxLength={500}
              placeholder={t("whyNeededPlaceholder")}
              className={controlClass}
            />
          </div>
          <div className="min-w-0 sm:col-span-4">
            <label htmlFor="est-line-gst" className={labelClass}>
              {t("gstRate")}
            </label>
            <select
              id="est-line-gst"
              name="gstRatePercent"
              required
              className={controlClass}
              defaultValue={String(DEFAULT_GST_RATE_PERCENT)}
            >
              {GST_RATE_OPTIONS.map((rate) => (
                <option key={rate} value={rate}>
                  {rate}%
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-slate-500">{t("newWorkWaitingHint")}</p>
          <Button
            type="submit"
            size="md"
            loading={pending}
            className="min-h-11 shrink-0 bg-blue-600 px-4 text-[14px] font-bold text-white hover:bg-blue-700"
          >
            {pending ? t("saving") : t("addWorkToJobCard")}
          </Button>
        </div>

        {state.message && !state.ok ? (
          <p className="text-[13px] text-danger" role="status">
            {state.message}
          </p>
        ) : null}
      </form>
    </section>
  );
}

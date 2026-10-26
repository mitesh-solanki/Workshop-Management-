"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  savePermissionLineAction,
  type EstimateActionState,
} from "@/app/actions/estimates";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/ui/form-select";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import {
  isZeroRupeesInput,
  paiseToRupeesInput,
  sanitizeRupeesTyping,
} from "@/lib/money";
import { cn } from "@/lib/utils";
import { QuantityStepper } from "@/modules/inventory/components/quantity-stepper";
import {
  ESTIMATE_APPROVAL_METHODS,
  type EstimateApprovalStateValue,
} from "@/modules/estimates/schema";

const initial: EstimateActionState = { ok: false };

const controlClass =
  "h-11 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-[14px] shadow-xs outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/25";

const labelClass = "mb-1.5 block text-[13px] font-bold text-slate-700";

function defaultSelectedState(
  currentState: EstimateApprovalStateValue,
): EstimateApprovalStateValue {
  return currentState === "PENDING" ? "APPROVED" : currentState;
}

type Props = {
  orderId: string;
  lineId: string;
  currentState: EstimateApprovalStateValue;
  description: string;
  quantity: number;
  unitPricePaise: number;
  onSaved?: () => void;
};

const DECISIONS: {
  value: EstimateApprovalStateValue;
  mark: string;
  labelKey: "decisionAgreed" | "decisionWaiting" | "decisionSaidNo";
}[] = [
  { value: "APPROVED", mark: "✓", labelKey: "decisionAgreed" },
  { value: "PENDING", mark: "…", labelKey: "decisionWaiting" },
  { value: "REJECTED", mark: "✕", labelKey: "decisionSaidNo" },
];

export function LineApprovalForm({
  orderId,
  lineId,
  currentState,
  description,
  quantity,
  unitPricePaise,
  onSaved,
}: Props) {
  const t = useTranslations("estimates");
  const bound = useMemo(
    () => savePermissionLineAction.bind(null, orderId, lineId),
    [orderId, lineId],
  );
  const [state, formAction, pending] = useActionState(bound, initial);
  const handledMessage = useRef<string | null>(null);
  const [selectedState, setSelectedState] = useState<EstimateApprovalStateValue>(
    () => defaultSelectedState(currentState),
  );
  const [syncedApproval, setSyncedApproval] = useState(currentState);
  if (syncedApproval !== currentState) {
    setSyncedApproval(currentState);
    setSelectedState(defaultSelectedState(currentState));
  }

  useEffect(() => {
    if (!state.message || state.message === handledMessage.current) return;
    handledMessage.current = state.message;
    if (state.ok) {
      toast.success(
        state.message === "approvalSaved" ? t("approvalSaved") : state.message,
      );
      onSaved?.();
    } else {
      toast.error(state.message);
    }
  }, [state, onSaved, t]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="approvalState" value={selectedState} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:gap-3">
        <div className="min-w-0 sm:col-span-6">
          <label htmlFor={`work-${lineId}`} className={labelClass}>
            {t("workServiceName")}
          </label>
          <Input
            id={`work-${lineId}`}
            name="description"
            required
            maxLength={500}
            defaultValue={description}
            className={controlClass}
          />
        </div>
        <div className="min-w-0 sm:col-span-2">
          <QuantityStepper
            id={`qty-${lineId}`}
            name="quantity"
            label={t("quantity")}
            defaultValue={quantity}
            min={1}
          />
        </div>
        <div className="min-w-0 sm:col-span-4">
          <label htmlFor={`price-${lineId}`} className={labelClass}>
            {t("priceEach")}
          </label>
          <Input
            id={`price-${lineId}`}
            name="unitPriceRupees"
            type="text"
            inputMode="decimal"
            required
            defaultValue={paiseToRupeesInput(unitPricePaise)}
            className={cn(controlClass, "tabular-nums")}
            onFocus={(event) => {
              if (isZeroRupeesInput(event.currentTarget.value)) {
                event.currentTarget.select();
              }
            }}
            onBeforeInput={(event) => {
              const data = (event.nativeEvent as InputEvent).data;
              if (data == null || data === "") return;
              if (!/^[\d.]+$/.test(data)) event.preventDefault();
            }}
            onInput={(event) => {
              const el = event.currentTarget;
              const next = sanitizeRupeesTyping(el.value);
              if (el.value !== next) el.value = next;
            }}
          />
        </div>
      </div>

      <fieldset className="min-w-0">
        <legend className="mb-2 text-[13px] font-bold text-slate-700">
          {t("customerSaidTitle")}
        </legend>
        <div
          role="group"
          aria-label={t("customerSaidTitle")}
          className="flex flex-wrap gap-2"
        >
          {DECISIONS.map(({ value, mark, labelKey }) => {
            const active = selectedState === value;
            return (
              <button
                key={value}
                type="button"
                disabled={pending}
                aria-pressed={active}
                onClick={() => setSelectedState(value)}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-[9px] border bg-white px-3.5 text-[13px] font-semibold transition-colors disabled:opacity-60",
                  active
                    ? value === "APPROVED"
                      ? "border-emerald-600 bg-emerald-50 text-emerald-800 shadow-[0_0_0_2px_#d1fae5]"
                      : value === "PENDING"
                        ? "border-amber-500 bg-amber-50 text-amber-900 shadow-[0_0_0_2px_#fef3c7]"
                        : "border-red-500 bg-red-50 text-red-800 shadow-[0_0_0_2px_#fee2e2]"
                    : "border-slate-300 text-slate-700 hover:bg-slate-50",
                )}
              >
                <span aria-hidden>{mark}</span>
                {t(labelKey)}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
        <div className="min-w-0 sm:col-span-4">
          <label htmlFor={`method-${lineId}`} className={labelClass}>
            {t("speakHowTitle")}
          </label>
          <FormSelect
            id={`method-${lineId}`}
            name="method"
            required
            defaultValue="MANUAL"
            options={ESTIMATE_APPROVAL_METHODS.map((method) => ({
              value: method,
              label: t(`approvalMethods.${method}`),
            }))}
          />
        </div>
        <div className="min-w-0 sm:col-span-8">
          <label htmlFor={`note-${lineId}`} className={labelClass}>
            {t("approvalNoteOptional")}
          </label>
          <Input
            id={`note-${lineId}`}
            name="note"
            maxLength={2000}
            className={controlClass}
            placeholder={t("approvalNotePlaceholder")}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] text-slate-500">{t("editHistoryHint")}</p>
        <Button
          type="submit"
          size="md"
          loading={pending}
          className="min-h-11 shrink-0 bg-blue-600 px-4 text-[14px] font-bold text-white hover:bg-blue-700"
        >
          {pending ? t("saving") : t("saveChangesToJob")}
        </Button>
      </div>

      {state.message && !state.ok ? (
        <p className="text-[13px] text-danger" role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useTranslations } from "next-intl";
import {
  savePermissionLineAction,
  type EstimateActionState,
} from "@/app/actions/estimates";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/ui/form-select";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { toastStockError } from "@/components/ui/toast-stock-error";
import {
  isZeroRupeesInput,
  paiseToRupeesInput,
  sanitizeRupeesTyping,
} from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  PartsSearchSelect,
  type PartsSearchItem,
} from "@/modules/inventory/components/parts-search-select";
import { QuantityStepper } from "@/modules/inventory/components/quantity-stepper";
import {
  ESTIMATE_APPROVAL_METHODS,
  type EstimateApprovalStateValue,
  type EstimateLineTypeValue,
} from "@/modules/estimates/schema";

const initial: EstimateActionState = { ok: false };

const controlClass =
  "h-11 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-[14px] shadow-xs outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/25";

const labelClass = "mb-1 block text-[13px] font-bold text-slate-700";

type Props = {
  orderId: string;
  lineId: string;
  lineType: EstimateLineTypeValue;
  currentState: EstimateApprovalStateValue;
  description: string;
  quantity: number;
  unitPricePaise: number;
  initialPartId?: string | null;
  onSaved?: () => void;
};

const DECISIONS: {
  value: EstimateApprovalStateValue;
  mark: string;
  labelKey: "decisionAgreed" | "decisionSaidNo";
}[] = [
  { value: "APPROVED", mark: "✓", labelKey: "decisionAgreed" },
  { value: "REJECTED", mark: "✕", labelKey: "decisionSaidNo" },
];

export function LineApprovalForm({
  orderId,
  lineId,
  lineType,
  currentState,
  description,
  quantity,
  unitPricePaise,
  initialPartId = null,
  onSaved,
}: Props) {
  const t = useTranslations("estimates");
  const ti = useTranslations("inventory");
  const bound = useMemo(
    () => savePermissionLineAction.bind(null, orderId, lineId),
    [orderId, lineId],
  );
  const [state, formAction, pending] = useActionState(bound, initial);
  const [decisionPending, startDecision] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const handledMessage = useRef<string | null>(null);
  const [selectedState, setSelectedState] =
    useState<EstimateApprovalStateValue>(currentState);
  const [syncedApproval, setSyncedApproval] = useState(currentState);
  const [partId, setPartId] = useState(initialPartId ?? "");
  const [selectedPart, setSelectedPart] = useState<PartsSearchItem | null>(null);
  const [workDescription, setWorkDescription] = useState(description);
  const [priceRupees, setPriceRupees] = useState(
    paiseToRupeesInput(unitPricePaise),
  );
  const busy = pending || decisionPending;

  if (syncedApproval !== currentState) {
    setSyncedApproval(currentState);
    setSelectedState(currentState);
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
      toastStockError(state.message, {
        stockPartId: state.stockPartId,
        viewStockLabel: ti("errors.viewStock"),
      });
    }
  }, [state, onSaved, t, ti]);

  const descriptionValue =
    lineType === "PART" && selectedPart
      ? `${selectedPart.name} (${selectedPart.sku})`
      : workDescription;

  function saveDecision(nextState: EstimateApprovalStateValue) {
    if (busy) return;
    if (lineType === "PART" && !partId) return;
    if (nextState === selectedState) return;
    const previous = selectedState;
    setSelectedState(nextState);
    const form = formRef.current;
    if (!form) {
      setSelectedState(previous);
      return;
    }
    const formData = new FormData(form);
    formData.set("approvalState", nextState);
    formData.set("description", descriptionValue);
    formData.set(
      "unitPriceRupees",
      isZeroRupeesInput(priceRupees) ? "0" : priceRupees,
    );
    startDecision(async () => {
      const result = await savePermissionLineAction(
        orderId,
        lineId,
        { ok: false },
        formData,
      );
      if (result.ok) {
        toast.success(t("approvalSaved"));
        return;
      }
      setSelectedState(previous);
      toastStockError(result.message ?? t("errors.lineBilled"), {
        stockPartId: result.stockPartId,
        viewStockLabel: ti("errors.viewStock"),
      });
    });
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-5">
      <input type="hidden" name="approvalState" value={selectedState} />
      <input type="hidden" name="description" value={descriptionValue} />

      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_7.5rem_10.5rem] lg:grid-cols-[minmax(0,1.2fr)_7.5rem_11rem]">
        <div className="min-w-0">
          {lineType === "PART" ? (
            <>
              <label htmlFor={`part-${lineId}`} className={labelClass}>
                {ti("part")}
              </label>
              <PartsSearchSelect
                id={`part-${lineId}`}
                value={partId}
                onChange={(nextId, part) => {
                  setPartId(nextId);
                  setSelectedPart(part);
                  if (part) {
                    setWorkDescription(`${part.name} (${part.sku})`);
                    setPriceRupees(paiseToRupeesInput(part.sellingPricePaise));
                  }
                }}
              />
            </>
          ) : (
            <>
              <label htmlFor={`work-${lineId}`} className={labelClass}>
                {t("workServiceName")}
              </label>
              <Input
                id={`work-${lineId}`}
                required
                maxLength={500}
                value={workDescription}
                onChange={(event) => setWorkDescription(event.target.value)}
                className={controlClass}
              />
            </>
          )}
        </div>

        <QuantityStepper
          id={`qty-${lineId}`}
          name="quantity"
          label={t("quantity")}
          defaultValue={quantity}
          min={1}
        />

        <div className="min-w-0">
          <label htmlFor={`price-${lineId}`} className={labelClass}>
            {t("priceEach")}
          </label>
          <Input
            id={`price-${lineId}`}
            name="unitPriceRupees"
            type="text"
            inputMode="decimal"
            required
            value={priceRupees}
            onChange={(event) =>
              setPriceRupees(sanitizeRupeesTyping(event.target.value))
            }
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
          />
        </div>
      </div>

      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[auto_minmax(9rem,12rem)_minmax(0,1fr)]">
        <fieldset className="min-w-0">
          <legend className={labelClass}>{t("customerSaidTitle")}</legend>
          <div
            role="group"
            aria-label={t("customerSaidTitle")}
            className="flex flex-wrap gap-1.5"
          >
            {DECISIONS.map(({ value, mark, labelKey }) => {
              const active = selectedState === value;
              return (
                <button
                  key={value}
                  type="button"
                  disabled={busy || (lineType === "PART" && !partId)}
                  aria-pressed={active}
                  onClick={() => saveDecision(value)}
                  className={cn(
                    "inline-flex h-11 min-h-11 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-semibold transition-colors disabled:opacity-60",
                    value === "APPROVED"
                      ? active
                        ? "border-emerald-600 bg-emerald-50 text-emerald-800 shadow-[0_0_0_2px_#d1fae5]"
                        : "border-emerald-200 bg-white text-emerald-700 hover:border-emerald-400 hover:bg-emerald-50"
                      : active
                        ? "border-red-500 bg-red-50 text-red-800 shadow-[0_0_0_2px_#fee2e2]"
                        : "border-red-200 bg-white text-red-700 hover:border-red-400 hover:bg-red-50",
                  )}
                >
                  <span aria-hidden>{mark}</span>
                  {t(labelKey)}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="min-w-0">
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

        <div className="min-w-0">
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

      <div className="flex justify-end">
        <Button
          type="submit"
          size="md"
          loading={busy}
          disabled={lineType === "PART" && !partId}
          className="min-h-11 w-full shrink-0 bg-blue-600 px-4 text-[14px] font-bold text-white hover:bg-blue-700 sm:w-auto"
        >
          {busy ? t("saving") : t("saveChangesToJob")}
        </Button>
      </div>

      {state.message && !state.ok ? (
        <p className="text-[13px] text-danger" role="status">
          {state.message}
          {state.stockPartId ? (
            <>
              {" "}
              <a
                href={`/inventory/${state.stockPartId}`}
                className="font-semibold underline underline-offset-2"
              >
                {ti("errors.viewStock")}
              </a>
            </>
          ) : null}
        </p>
      ) : null}
    </form>
  );
}

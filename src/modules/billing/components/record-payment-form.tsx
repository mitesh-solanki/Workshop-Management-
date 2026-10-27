"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/ui/form-select";
import { toast } from "@/components/ui/toast";
import {
  formatRupees,
  parseRupeesToPaise,
  paiseToRupeesInput,
  sanitizeRupeesTyping,
} from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  recordPaymentAction,
  type BillingActionState,
} from "@/app/actions/billing";
import {
  PAYMENT_METHODS,
  type PaymentMethodValue,
} from "@/modules/billing/schema";

const initial: BillingActionState = { ok: false };

const controlClass =
  "h-11 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-[14px] shadow-xs outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/25";

const labelClass = "mb-1.5 block text-[13px] font-bold text-slate-700";

type SingleMethod = "CASH" | "UPI" | "CARD";

function isSingleMethod(method: PaymentMethodValue): method is SingleMethod {
  return method === "CASH" || method === "UPI" || method === "CARD";
}

function methodFieldName(method: SingleMethod): string {
  switch (method) {
    case "CASH":
      return "cashRupees";
    case "UPI":
      return "upiRupees";
    case "CARD":
      return "cardRupees";
  }
}

/** Keep typing flexible, but never above the balance due. */
function clampRupeesToMax(raw: string, maxPaise: number): string {
  const sanitized = sanitizeRupeesTyping(raw);
  const paise = parseRupeesToPaise(sanitized);
  if (paise == null) return sanitized;
  if (paise > maxPaise) return paiseToRupeesInput(maxPaise);
  return sanitized;
}

type Props = {
  invoiceId: string;
  orderId: string;
  pendingPaise: number;
};

export function RecordPaymentForm({
  invoiceId,
  orderId,
  pendingPaise,
}: Props) {
  const t = useTranslations("billing");
  const idPrefix = useId();
  const bound = recordPaymentAction.bind(null, orderId, invoiceId);
  const [state, formAction, pending] = useActionState(bound, initial);
  const handledMessage = useRef<string | null>(null);
  const [method, setMethod] = useState<PaymentMethodValue>("UPI");
  const [amountRupees, setAmountRupees] = useState(
    paiseToRupeesInput(pendingPaise),
  );
  const [cashRupees, setCashRupees] = useState("");
  const [upiRupees, setUpiRupees] = useState("");
  const [cardRupees, setCardRupees] = useState("");
  const maxAmountLabel = formatRupees(pendingPaise);

  useEffect(() => {
    setAmountRupees((current) => clampRupeesToMax(current, pendingPaise));
  }, [pendingPaise]);

  useEffect(() => {
    if (!state.message || state.message === handledMessage.current) return;
    handledMessage.current = state.message;
    if (state.ok) {
      toast.success(
        state.message === "paymentRecorded"
          ? t("paymentRecorded")
          : state.message,
      );
    } else {
      toast.error(state.message);
    }
  }, [state, t]);

  function onAmountChange(raw: string) {
    setAmountRupees(clampRupeesToMax(raw, pendingPaise));
  }

  function onMixedChange(part: "cash" | "upi" | "card", raw: string) {
    const sanitized = sanitizeRupeesTyping(raw);
    const otherCash = part === "cash" ? 0 : (parseRupeesToPaise(cashRupees) ?? 0);
    const otherUpi = part === "upi" ? 0 : (parseRupeesToPaise(upiRupees) ?? 0);
    const otherCard = part === "card" ? 0 : (parseRupeesToPaise(cardRupees) ?? 0);
    const maxForPart = Math.max(0, pendingPaise - otherCash - otherUpi - otherCard);
    const clamped = clampRupeesToMax(sanitized, maxForPart);
    const nextCash = part === "cash" ? clamped : cashRupees;
    const nextUpi = part === "upi" ? clamped : upiRupees;
    const nextCard = part === "card" ? clamped : cardRupees;
    if (part === "cash") setCashRupees(clamped);
    if (part === "upi") setUpiRupees(clamped);
    if (part === "card") setCardRupees(clamped);
    const totalPaise =
      (parseRupeesToPaise(nextCash) ?? 0) +
      (parseRupeesToPaise(nextUpi) ?? 0) +
      (parseRupeesToPaise(nextCard) ?? 0);
    setAmountRupees(paiseToRupeesInput(Math.min(totalPaise, pendingPaise)));
  }

  if (pendingPaise <= 0) {
    return (
      <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-[14px] font-semibold text-emerald-800">
        {t("fullyPaid")}
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="rounded-lg border border-[#cfdcf1] bg-white px-4 py-3 shadow-[0_3px_17px_rgba(36,58,99,0.04)]">
        <p className="text-[13px] font-bold text-slate-500">
          {t("pendingBalance")}
        </p>
        <p className="mt-0.5 text-[18px] font-bold tabular-nums text-slate-900">
          {maxAmountLabel}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="min-w-0">
          <label htmlFor={`${idPrefix}-method`} className={labelClass}>
            {t("paymentMethod")}
          </label>
          <FormSelect
            id={`${idPrefix}-method`}
            name="method"
            value={method}
            onValueChange={(value) =>
              setMethod(value as PaymentMethodValue)
            }
            options={PAYMENT_METHODS.map((value) => ({
              value,
              label: t(`methods.${value}`),
            }))}
          />
        </div>
        <div className="min-w-0">
          <label htmlFor={`${idPrefix}-amount`} className={labelClass}>
            {t("amount")}
          </label>
          <input
            id={`${idPrefix}-amount`}
            name="amountRupees"
            className={cn(controlClass, "tabular-nums")}
            value={amountRupees}
            onChange={(event) => onAmountChange(event.target.value)}
            inputMode="decimal"
            max={paiseToRupeesInput(pendingPaise)}
            aria-describedby={`${idPrefix}-amount-hint`}
          />
          <p
            id={`${idPrefix}-amount-hint`}
            className="mt-1.5 text-[13px] text-slate-500"
          >
            {t("amountHint")}
          </p>
        </div>
        {isSingleMethod(method) ? (
          <div className="min-w-0">
            <label
              htmlFor={`${idPrefix}-${methodFieldName(method)}`}
              className={labelClass}
            >
              {t(`methods.${method}`)}
            </label>
            <input
              id={`${idPrefix}-${methodFieldName(method)}`}
              name={methodFieldName(method)}
              className={cn(controlClass, "tabular-nums")}
              value={amountRupees}
              onChange={(event) => onAmountChange(event.target.value)}
              inputMode="decimal"
              max={paiseToRupeesInput(pendingPaise)}
            />
          </div>
        ) : (
          <div className="hidden sm:block" aria-hidden />
        )}
      </div>

      {method === "MIXED" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="min-w-0">
              <label htmlFor={`${idPrefix}-cash`} className={labelClass}>
                {t("methods.CASH")}
              </label>
              <input
                id={`${idPrefix}-cash`}
                name="cashRupees"
                className={cn(controlClass, "tabular-nums")}
                value={cashRupees}
                onChange={(event) =>
                  onMixedChange("cash", event.target.value)
                }
                inputMode="decimal"
                placeholder="0"
              />
            </div>
            <div className="min-w-0">
              <label htmlFor={`${idPrefix}-upi`} className={labelClass}>
                {t("methods.UPI")}
              </label>
              <input
                id={`${idPrefix}-upi`}
                name="upiRupees"
                className={cn(controlClass, "tabular-nums")}
                value={upiRupees}
                onChange={(event) =>
                  onMixedChange("upi", event.target.value)
                }
                inputMode="decimal"
                placeholder="0"
              />
            </div>
            <div className="min-w-0">
              <label htmlFor={`${idPrefix}-card`} className={labelClass}>
                {t("methods.CARD")}
              </label>
              <input
                id={`${idPrefix}-card`}
                name="cardRupees"
                className={cn(controlClass, "tabular-nums")}
                value={cardRupees}
                onChange={(event) =>
                  onMixedChange("card", event.target.value)
                }
                inputMode="decimal"
                placeholder="0"
              />
            </div>
          </div>
          <p className="text-[13px] text-slate-500">{t("mixedHint")}</p>
        </>
      ) : null}

      {state.message && !state.ok ? (
        <p className="text-[13px] text-danger" role="status">
          {state.message}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button
          type="submit"
          size="md"
          loading={pending}
          className="min-h-11 w-full bg-blue-600 px-5 text-[14px] font-bold text-white hover:bg-blue-700 sm:w-auto"
        >
          {pending ? t("saving") : t("savePayment")}
        </Button>
      </div>
    </form>
  );
}

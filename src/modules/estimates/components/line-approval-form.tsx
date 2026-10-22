"use client";

import { useActionState, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  setLineApprovalAction,
  type EstimateActionState,
} from "@/app/actions/estimates";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ESTIMATE_APPROVAL_METHODS,
  type EstimateApprovalStateValue,
} from "@/modules/estimates/schema";

const initial: EstimateActionState = { ok: false };

const selectClass =
  "h-9 min-h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/40";

function defaultSelectedState(
  currentState: EstimateApprovalStateValue,
): EstimateApprovalStateValue {
  return currentState === "PENDING" ? "APPROVED" : currentState;
}

type Props = {
  orderId: string;
  lineId: string;
  currentState: EstimateApprovalStateValue;
};

const STATES: {
  value: EstimateApprovalStateValue;
  tone: "approved" | "rejected" | "pending";
}[] = [
  { value: "APPROVED", tone: "approved" },
  { value: "REJECTED", tone: "rejected" },
  { value: "PENDING", tone: "pending" },
];

export function LineApprovalForm({ orderId, lineId, currentState }: Props) {
  const t = useTranslations("estimates");
  const bound = useMemo(
    () => setLineApprovalAction.bind(null, orderId, lineId),
    [orderId, lineId],
  );
  const [state, formAction, pending] = useActionState(bound, initial);
  const [selectedState, setSelectedState] = useState<EstimateApprovalStateValue>(
    () => defaultSelectedState(currentState),
  );
  const [syncedCurrent, setSyncedCurrent] = useState(currentState);
  if (currentState !== syncedCurrent) {
    setSyncedCurrent(currentState);
    setSelectedState(defaultSelectedState(currentState));
  }

  const noChange = selectedState === currentState;
  const canSave = !pending && !noChange;

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="approvalState" value={selectedState} />

      <div className="grid grid-cols-3 gap-1.5">
        {STATES.map(({ value, tone }) => {
          const active = selectedState === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setSelectedState(value)}
              className={cn(
                "flex min-h-9 items-center justify-center rounded-md border px-1.5 text-xs font-medium transition-colors sm:text-sm",
                active &&
                  tone === "approved" &&
                  "border-emerald-600 bg-emerald-600 text-white",
                active &&
                  tone === "rejected" &&
                  "border-danger bg-danger text-white",
                active &&
                  tone === "pending" &&
                  "border-slate-600 bg-slate-600 text-white",
                !active && "border-slate-200 text-slate-700 hover:bg-slate-50",
              )}
            >
              {t(`approvalStates.${value}`)}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="sr-only" htmlFor={`method-${lineId}`}>
          {t("approvalMethod")}
        </label>
        <select
          id={`method-${lineId}`}
          name="method"
          required
          className={cn(selectClass, "sm:max-w-[11rem]")}
          defaultValue="MANUAL"
          disabled={noChange}
        >
          {ESTIMATE_APPROVAL_METHODS.map((method) => (
            <option key={method} value={method}>
              {t(`approvalMethods.${method}`)}
            </option>
          ))}
        </select>
        <input
          id={`note-${lineId}`}
          name="note"
          maxLength={2000}
          className={cn(selectClass, "min-w-0 flex-1")}
          placeholder={t("approvalNotePlaceholder")}
          disabled={noChange}
          aria-label={t("approvalNote")}
        />
        <Button
          type="submit"
          size="sm"
          loading={pending}
          disabled={!canSave}
          className="shrink-0"
        >
          {pending ? t("saving") : t("saveApproval")}
        </Button>
      </div>

      {noChange ? (
        <p className="text-xs text-slate-500" role="status">
          {t("approvalAlreadySet", {
            state: t(`approvalStates.${currentState}`),
          })}
        </p>
      ) : state.message && !state.ok ? (
        <p className="text-xs text-danger" role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

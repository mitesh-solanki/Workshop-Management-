"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  setLineApprovalAction,
  type EstimateActionState,
} from "@/app/actions/estimates";
import {
  ESTIMATE_APPROVAL_METHODS,
  type EstimateApprovalStateValue,
} from "@/modules/estimates/schema";

const initial: EstimateActionState = { ok: false };

const inputClass =
  "min-h-12 w-full rounded-md border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring";

type Props = {
  orderId: string;
  lineId: string;
  currentState: EstimateApprovalStateValue;
};

export function LineApprovalForm({ orderId, lineId, currentState }: Props) {
  const t = useTranslations("estimates");
  const bound = useMemo(
    () => setLineApprovalAction.bind(null, orderId, lineId),
    [orderId, lineId],
  );
  const [state, formAction, pending] = useActionState(bound, initial);
  /** Default to Approve when still pending; otherwise mirror current state. */
  const [selectedState, setSelectedState] = useState<EstimateApprovalStateValue>(
    currentState === "PENDING" ? "APPROVED" : currentState,
  );

  useEffect(() => {
    setSelectedState(currentState === "PENDING" ? "APPROVED" : currentState);
  }, [currentState]);

  const noChange = selectedState === currentState;
  const canSave = !pending && !noChange;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`approvalState-${lineId}`} className="text-sm font-medium">
            {t("approvalState")}
          </label>
          <select
            id={`approvalState-${lineId}`}
            name="approvalState"
            required
            className={inputClass}
            value={selectedState}
            onChange={(event) =>
              setSelectedState(event.target.value as EstimateApprovalStateValue)
            }
          >
            <option value="APPROVED">{t("approvalStates.APPROVED")}</option>
            <option value="REJECTED">{t("approvalStates.REJECTED")}</option>
            <option value="PENDING">{t("approvalStates.PENDING")}</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`method-${lineId}`} className="text-sm font-medium">
            {t("approvalMethod")}
          </label>
          <select
            id={`method-${lineId}`}
            name="method"
            required
            className={inputClass}
            defaultValue="MANUAL"
            disabled={noChange}
          >
            {ESTIMATE_APPROVAL_METHODS.map((method) => (
              <option key={method} value={method}>
                {t(`approvalMethods.${method}`)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`note-${lineId}`} className="text-sm font-medium">
          {t("approvalNote")}
        </label>
        <input
          id={`note-${lineId}`}
          name="note"
          maxLength={2000}
          className={inputClass}
          placeholder={t("approvalNotePlaceholder")}
          disabled={noChange}
        />
      </div>
      {noChange ? (
        <p className="text-sm text-muted-foreground" role="status">
          {t("approvalAlreadySet", {
            state: t(`approvalStates.${currentState}`),
          })}
        </p>
      ) : state.message ? (
        <p
          className={
            state.ok ? "text-sm text-foreground" : "text-sm text-destructive"
          }
          role="status"
        >
          {state.ok ? t("approvalSaved") : state.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={!canSave}
        className="min-h-12 rounded-md bg-primary px-4 text-base font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending ? t("saving") : t("saveApproval")}
      </button>
    </form>
  );
}

"use client";

import { useActionState, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  changeServiceOrderStatusAction,
  type ServiceOrderActionState,
} from "@/app/actions/service-orders";
import {
  STATUS_TRANSITIONS,
  type ServiceOrderStatusValue,
} from "@/modules/service-orders/schema";

const initial: ServiceOrderActionState = { ok: false };

const inputClass =
  "min-h-12 w-full rounded-md border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring";

type Props = {
  orderId: string;
  currentStatus: ServiceOrderStatusValue;
};

export function StatusForm({ orderId, currentStatus }: Props) {
  const t = useTranslations("orders");
  const bound = useMemo(
    () => changeServiceOrderStatusAction.bind(null, orderId),
    [orderId],
  );
  const [state, formAction, pending] = useActionState(bound, initial);
  const nextStatuses = STATUS_TRANSITIONS[currentStatus];

  if (nextStatuses.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t("statusTerminal")}</p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <label htmlFor="status" className="text-sm font-medium">
          {t("changeStatus")}
        </label>
        <select
          id="status"
          name="status"
          required
          className={inputClass}
          defaultValue={nextStatuses[0]}
        >
          {nextStatuses.map((status) => (
            <option key={status} value={status}>
              {t(`statuses.${status}`)}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 shrink-0 rounded-md bg-primary px-4 text-base font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending ? t("saving") : t("updateStatus")}
      </button>
      {state.message && (
        <p
          className={
            state.ok
              ? "text-sm text-foreground sm:basis-full"
              : "text-sm text-destructive sm:basis-full"
          }
          role="status"
        >
          {state.ok ? t("statusUpdated") : state.message}
        </p>
      )}
    </form>
  );
}

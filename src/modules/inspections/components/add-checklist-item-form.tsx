"use client";

import { useActionState, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  addChecklistItemAction,
  type InspectionActionState,
} from "@/app/actions/inspections";

const initial: InspectionActionState = { ok: false };

const inputClass =
  "min-h-12 w-full rounded-md border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring";

type Props = { orderId: string };

export function AddChecklistItemForm({ orderId }: Props) {
  const t = useTranslations("inspections");
  const bound = useMemo(
    () => addChecklistItemAction.bind(null, orderId),
    [orderId],
  );
  const [state, formAction, pending] = useActionState(bound, initial);

  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row">
      <input
        name="label"
        required
        maxLength={120}
        placeholder={t("customItemPlaceholder")}
        className={inputClass}
        aria-label={t("addCustomItem")}
      />
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 shrink-0 rounded-md border px-4 text-base font-medium disabled:opacity-60"
      >
        {pending ? t("saving") : t("addCustomItem")}
      </button>
      {state.message && !state.ok && (
        <p className="text-sm text-destructive sm:basis-full" role="status">
          {state.message}
        </p>
      )}
    </form>
  );
}

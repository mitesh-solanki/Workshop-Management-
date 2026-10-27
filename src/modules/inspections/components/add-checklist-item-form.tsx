"use client";

import { useActionState, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  addChecklistItemAction,
  type InspectionActionState,
} from "@/app/actions/inspections";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initial: InspectionActionState = { ok: false };

type Props = { orderId: string };

export function AddChecklistItemForm({ orderId }: Props) {
  const t = useTranslations("inspections");
  const bound = useMemo(
    () => addChecklistItemAction.bind(null, orderId),
    [orderId],
  );
  const [state, formAction, pending] = useActionState(bound, initial);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <strong className="text-[16px] font-semibold text-slate-900">
            {t("addCustomItemTitle")}
          </strong>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {t("addCustomItemHint")}
          </p>
        </div>
      </div>
      <form
        action={formAction}
        className="flex flex-col gap-2 sm:flex-row sm:items-center"
      >
        <Input
          name="label"
          required
          maxLength={120}
          placeholder={t("customItemPlaceholder")}
          aria-label={t("addCustomItem")}
          className="h-11 min-h-11 flex-1 rounded-lg border-slate-300"
        />
        <Button
          type="submit"
          size="sm"
          loading={pending}
          variant="secondary"
          className="h-11 min-h-11 shrink-0 border-slate-300"
        >
          {pending ? t("saving") : t("addCustomItem")}
        </Button>
        {state.message && !state.ok ? (
          <p className="text-xs text-danger sm:basis-full" role="status">
            {state.message}
          </p>
        ) : null}
      </form>
    </div>
  );
}

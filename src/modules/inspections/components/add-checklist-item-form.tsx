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
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Input
        name="label"
        required
        maxLength={120}
        placeholder={t("customItemPlaceholder")}
        aria-label={t("addCustomItem")}
        className="h-9 min-h-9 flex-1"
      />
      <Button type="submit" size="sm" loading={pending} variant="secondary" className="shrink-0">
        {pending ? t("saving") : t("addCustomItem")}
      </Button>
      {state.message && !state.ok ? (
        <p className="text-xs text-danger sm:basis-full" role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

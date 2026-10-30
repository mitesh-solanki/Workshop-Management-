"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  addChecklistItemAction,
  type InspectionActionState,
} from "@/app/actions/inspections";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { PartNameSuggestInput } from "@/modules/inventory/components/part-name-suggest-input";

const initial: InspectionActionState = { ok: false };

type Props = { inspectionId: string };

export function AddChecklistItemForm({ inspectionId }: Props) {
  const t = useTranslations("inspections");
  const bound = useMemo(
    () => addChecklistItemAction.bind(null, inspectionId),
    [inspectionId],
  );
  const [state, formAction, pending] = useActionState(bound, initial);
  const [label, setLabel] = useState("");
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!state.message || state.message === handled.current) return;
    handled.current = state.message;
    if (state.ok) {
      setLabel("");
      toast.success(
        state.message === "itemAdded" ? t("itemAdded") : state.message,
      );
      return;
    }
    toast.error(state.message);
  }, [state, t]);

  return (
    <div className="space-y-3">
      <div>
        <strong className="text-[16px] font-semibold text-slate-900">
          {t("addCustomItemTitle")}
        </strong>
        <p className="mt-0.5 text-[11px] text-slate-500">
          {t("addCustomItemHint")}
        </p>
      </div>
      <form
        action={formAction}
        className="flex flex-col gap-2 sm:flex-row sm:items-center"
      >
        <div className="min-w-0 flex-1">
          <PartNameSuggestInput
            id="inspection-add-spare"
            name="label"
            value={label}
            onValueChange={setLabel}
            required
            maxLength={120}
            className="h-11 min-h-11 rounded-lg border-slate-300"
          />
        </div>
        <Button
          type="submit"
          size="sm"
          loading={pending}
          variant="secondary"
          className="h-11 min-h-11 shrink-0 border-slate-300"
        >
          {pending ? t("saving") : t("addCustomItem")}
        </Button>
      </form>
    </div>
  );
}

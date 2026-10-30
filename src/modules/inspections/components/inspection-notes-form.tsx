"use client";

import { useActionState, useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  updateInspectionNotesAction,
  type InspectionActionState,
} from "@/app/actions/inspections";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";

const initial: InspectionActionState = { ok: false };

type Props = {
  inspectionId: string;
  complaint: string | null;
  recommendedNotes: string | null;
  canEdit: boolean;
};

export function InspectionNotesForm({
  inspectionId,
  complaint,
  recommendedNotes,
  canEdit,
}: Props) {
  const t = useTranslations("inspections");
  const bound = useMemo(
    () => updateInspectionNotesAction.bind(null, inspectionId),
    [inspectionId],
  );
  const [state, formAction, pending] = useActionState(bound, initial);
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!state.message || state.message === handled.current) return;
    handled.current = state.message;
    if (state.ok) {
      toast.success(
        state.message === "notesSaved" ? t("notesSaved") : state.message,
      );
      return;
    }
    toast.error(state.message);
  }, [state, t]);

  if (!canEdit) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-slate-700">{t("complaint")}</p>
          <p className="whitespace-pre-wrap text-sm text-slate-600">
            {complaint?.trim() || t("notesEmpty")}
          </p>
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-slate-700">
            {t("recommendedNotes")}
          </p>
          <p className="whitespace-pre-wrap text-sm text-slate-600">
            {recommendedNotes?.trim() || t("notesEmpty")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="inspection-complaint" label={t("complaint")}>
          <Textarea
            id="inspection-complaint"
            name="complaint"
            rows={4}
            maxLength={4000}
            defaultValue={complaint ?? ""}
            placeholder={t("complaintPlaceholder")}
            className="min-h-[110px]"
          />
        </FormField>
        <FormField
          id="inspection-recommended"
          label={t("recommendedNotes")}
        >
          <Textarea
            id="inspection-recommended"
            name="recommendedNotes"
            rows={4}
            maxLength={4000}
            defaultValue={recommendedNotes ?? ""}
            placeholder={t("recommendedNotesPlaceholder")}
            className="min-h-[110px]"
          />
        </FormField>
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm" loading={pending}>
          {pending ? t("saving") : t("saveNotes")}
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useActionState, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  createEstimateAction,
  createEstimateRevisionAction,
  type EstimateActionState,
} from "@/app/actions/estimates";

const initial: EstimateActionState = { ok: false };

const inputClass =
  "min-h-12 w-full rounded-md border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring";

type CreateProps = {
  orderId: string;
  mode: "create";
};

type RevisionProps = {
  orderId: string;
  mode: "revision";
  nextRevision: number;
};

type Props = CreateProps | RevisionProps;

export function CreateEstimateForm(props: Props) {
  const t = useTranslations("estimates");
  const bound = useMemo(() => {
    if (props.mode === "revision") {
      return createEstimateRevisionAction.bind(null, props.orderId);
    }
    return createEstimateAction.bind(null, props.orderId);
  }, [props.mode, props.orderId]);
  const [state, formAction, pending] = useActionState(bound, initial);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="notes" className="text-sm font-medium">
          {t("notes")}
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          maxLength={2000}
          className={`${inputClass} py-3`}
          placeholder={t("notesPlaceholder")}
        />
      </div>
      {props.mode === "revision" && (
        <label className="flex min-h-12 items-center gap-3 text-base">
          <input
            type="checkbox"
            name="includeNewSources"
            value="true"
            defaultChecked
            className="size-5 shrink-0"
          />
          <span>{t("includeNewSources")}</span>
        </label>
      )}
      {state.message && (
        <p
          className={
            state.ok ? "text-sm text-foreground" : "text-sm text-destructive"
          }
          role="status"
        >
          {state.ok
            ? props.mode === "revision"
              ? t("revisionCreated")
              : t("estimateCreated")
            : state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 rounded-md bg-primary px-4 text-base font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending
          ? t("saving")
          : props.mode === "revision"
            ? t("createRevision", { number: props.nextRevision })
            : t("createFromSources")}
      </button>
    </form>
  );
}

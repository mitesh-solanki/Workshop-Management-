"use client";

import { useActionState, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  createEstimateAction,
  createEstimateRevisionAction,
  type EstimateActionState,
} from "@/app/actions/estimates";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";

const initial: EstimateActionState = { ok: false };

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
    <form action={formAction} className="flex w-full max-w-xl flex-col gap-4">
      <FormField id="notes" label={t("notes")} className="w-full">
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={2000}
          placeholder={t("notesPlaceholder")}
          className="min-h-20 w-full min-w-0 [field-sizing:fixed]"
        />
      </FormField>

      {props.mode === "revision" ? (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="includeNewSources"
            value="true"
            defaultChecked
            className="size-4 shrink-0"
          />
          <span>{t("includeNewSources")}</span>
        </label>
      ) : null}

      {state.message && !state.ok ? (
        <p className="text-sm text-red-600" role="status">
          {state.message}
        </p>
      ) : null}

      <div>
        <Button
          type="submit"
          size="sm"
          loading={pending}
          className="bg-blue-600 text-white hover:bg-blue-700 hover:text-white"
        >
          {pending
            ? t("saving")
            : props.mode === "revision"
              ? t("createRevision", { number: props.nextRevision })
              : t("createFromSources")}
        </Button>
      </div>
    </form>
  );
}

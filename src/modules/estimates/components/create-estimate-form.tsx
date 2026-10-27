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
import { markOpenLiveLinkEmbed } from "@/modules/live-link/components/live-link-staff-panel";

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
  const wrapped = useMemo(() => {
    return async (
      prev: EstimateActionState,
      formData: FormData,
    ): Promise<EstimateActionState> => {
      const result = await bound(prev, formData);
      if (result.ok && props.mode === "create") {
        markOpenLiveLinkEmbed(props.orderId);
      }
      return result;
    };
  }, [bound, props.mode, props.orderId]);
  const [state, formAction, pending] = useActionState(wrapped, initial);

  const isRevision = props.mode === "revision";

  return (
    <form action={formAction} className="flex w-full max-w-xl flex-col gap-4">
      <FormField
        id="notes"
        label={isRevision ? t("revisionReason") : t("notes")}
        className="w-full"
      >
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={2000}
          placeholder={
            isRevision
              ? t("revisionReasonPlaceholder")
              : t("notesPlaceholder")
          }
          className="min-h-20 w-full min-w-0 [field-sizing:fixed]"
        />
      </FormField>

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
            : isRevision
              ? t("createRevision", { number: props.nextRevision })
              : t("createFromSources")}
        </Button>
      </div>
    </form>
  );
}

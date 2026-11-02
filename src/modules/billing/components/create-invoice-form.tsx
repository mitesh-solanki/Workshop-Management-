"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { GST_STATE_CODES } from "@/lib/gstin";
import {
  createInvoiceAction,
  type BillingActionState,
} from "@/app/actions/billing";

const initial: BillingActionState = { ok: false };

type Props = {
  orderId: string;
  defaultPlaceOfSupplyStateCode: string;
};

export function CreateInvoiceForm({
  orderId,
  defaultPlaceOfSupplyStateCode,
}: Props) {
  const t = useTranslations("billing");
  const bound = createInvoiceAction.bind(null, orderId);
  const [state, formAction, pending] = useActionState(bound, initial);
  const handledMessage = useRef<string | null>(null);
  const placeOfSupplyStateCode = GST_STATE_CODES.includes(
    defaultPlaceOfSupplyStateCode as (typeof GST_STATE_CODES)[number],
  )
    ? defaultPlaceOfSupplyStateCode
    : "24";

  useEffect(() => {
    if (!state.message || state.message === handledMessage.current) return;
    handledMessage.current = state.message;
    if (state.ok) {
      toast.success(
        state.message === "invoiceCreated" || state.message === "draftCreated"
          ? t("draftCreated")
          : state.message,
      );
    } else {
      toast.error(state.message);
    }
  }, [state, t]);

  return (
    <form action={formAction} className="space-y-4">
      <input
        type="hidden"
        name="placeOfSupplyStateCode"
        value={placeOfSupplyStateCode}
      />

      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-950">
        {t("createDraftHint")}
      </p>

      {state.message && !state.ok ? (
        <p className="text-[13px] text-danger" role="status">
          {state.message}
        </p>
      ) : null}

      <div className="flex justify-start">
        <Button
          type="submit"
          size="md"
          loading={pending}
          className="min-h-11 bg-blue-600 px-5 text-[14px] font-bold text-white hover:bg-blue-700"
        >
          {pending ? t("saving") : t("createDraft")}
        </Button>
      </div>
    </form>
  );
}

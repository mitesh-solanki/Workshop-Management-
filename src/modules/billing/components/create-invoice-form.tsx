"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { GST_STATE_CODES } from "@/lib/gstin";
import { cn } from "@/lib/utils";
import {
  createInvoiceAction,
  type BillingActionState,
} from "@/app/actions/billing";

const initial: BillingActionState = { ok: false };

const controlClass =
  "h-11 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-[14px] shadow-xs outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/25";

const labelClass = "mb-1.5 block text-[13px] font-bold text-slate-700";

type Props = {
  orderId: string;
  defaultPlaceOfSupplyStateCode: string;
};

export function CreateInvoiceForm({
  orderId,
  defaultPlaceOfSupplyStateCode,
}: Props) {
  const t = useTranslations("billing");
  const tGst = useTranslations("gst");
  const idPrefix = useId();
  const bound = createInvoiceAction.bind(null, orderId);
  const [state, formAction, pending] = useActionState(bound, initial);
  const handledMessage = useRef<string | null>(null);
  const defaultCode = GST_STATE_CODES.includes(
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-start">
        <div className="min-w-0">
          <label htmlFor={`${idPrefix}-pos`} className={labelClass}>
            {t("placeOfSupply")}
          </label>
          <select
            id={`${idPrefix}-pos`}
            name="placeOfSupplyStateCode"
            defaultValue={defaultCode}
            className={controlClass}
          >
            {GST_STATE_CODES.map((code) => (
              <option key={code} value={code}>
                {tGst(`states.${code}`)} ({code})
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[13px] leading-snug text-slate-500">
            {t("placeOfSupplyHint")}
          </p>
        </div>
        <div className="min-w-0">
          <label htmlFor={`${idPrefix}-notes`} className={labelClass}>
            {t("notes")}
          </label>
          <textarea
            id={`${idPrefix}-notes`}
            name="notes"
            rows={3}
            className={cn(controlClass, "min-h-22 py-2.5 leading-snug")}
            placeholder={t("notesPlaceholder")}
          />
        </div>
      </div>

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

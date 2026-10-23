"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import {
  deleteDraftInvoiceAction,
  type BillingActionState,
} from "@/app/actions/billing";

const initial: BillingActionState = { ok: false };

type Props = {
  invoiceId: string;
  orderId: string;
};

export function DeleteDraftInvoiceForm({ invoiceId, orderId }: Props) {
  const t = useTranslations("billing");
  const bound = deleteDraftInvoiceAction.bind(null, orderId, invoiceId);
  const [state, formAction, pending] = useActionState(bound, initial);
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!state.message || state.message === handled.current) return;
    handled.current = state.message;
    if (state.ok) {
      toast.success(
        state.message === "draftDeleted" ? t("draftDeleted") : state.message,
      );
    } else {
      toast.error(state.message);
    }
  }, [state, t]);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(t("deleteDraftConfirm"))) {
          event.preventDefault();
        }
      }}
    >
      <Button
        type="submit"
        variant="outline"
        disabled={pending}
        className="min-h-11 border-red-200 text-red-700 hover:border-red-300 hover:bg-red-50 hover:text-red-800"
      >
        {pending ? t("saving") : t("deleteDraft")}
      </Button>
    </form>
  );
}

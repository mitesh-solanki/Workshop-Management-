"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import {
  remakeDraftInvoiceAction,
  type BillingActionState,
} from "@/app/actions/billing";

const initial: BillingActionState = { ok: false };

type Props = {
  invoiceId: string;
  orderId: string;
  placeOfSupplyStateCode: string;
  notes: string | null;
};

export function RemakeDraftInvoiceForm({
  invoiceId,
  orderId,
  placeOfSupplyStateCode,
  notes,
}: Props) {
  const t = useTranslations("billing");
  const bound = remakeDraftInvoiceAction.bind(null, orderId, invoiceId);
  const [state, formAction, pending] = useActionState(bound, initial);
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!state.message || state.message === handled.current) return;
    handled.current = state.message;
    if (state.ok) {
      toast.success(
        state.message === "draftRemade" ? t("draftRemade") : state.message,
      );
    } else {
      toast.error(state.message);
    }
  }, [state, t]);

  return (
    <form action={formAction}>
      <input
        type="hidden"
        name="placeOfSupplyStateCode"
        value={placeOfSupplyStateCode}
      />
      <input type="hidden" name="notes" value={notes ?? ""} />
      <Button
        type="submit"
        variant="outline"
        disabled={pending}
        className="min-h-11"
      >
        {pending ? t("saving") : t("remakeDraft")}
      </Button>
    </form>
  );
}

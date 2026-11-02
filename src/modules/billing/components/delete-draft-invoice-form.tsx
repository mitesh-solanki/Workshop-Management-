"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  deleteDraftInvoiceAction,
  type BillingActionState,
} from "@/app/actions/billing";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

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
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!state.message || state.message === handled.current) return;
    handled.current = state.message;
    if (state.ok) {
      toast.success(
        state.message === "draftDeleted" ? t("draftDeleted") : state.message,
      );
      const id = window.setTimeout(() => setOpen(false), 0);
      return () => window.clearTimeout(id);
    }
    toast.error(state.message);
  }, [state, t]);

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (pending && !next) return;
        setOpen(next);
      }}
      title={t("deleteDraftTitle")}
      description={t("deleteDraftConfirm")}
      confirmLabel={t("deleteDraft")}
      variant="danger"
      loading={pending && open}
      onConfirm={() => {
        formAction(new FormData());
      }}
      trigger={
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          className="min-h-11 border-red-200 text-red-700 hover:border-red-300 hover:bg-red-50 hover:text-red-800"
        >
          {pending ? t("saving") : t("deleteDraft")}
        </Button>
      }
    />
  );
}

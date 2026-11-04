"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { syncInvoiceFromJobCardAction } from "@/app/actions/billing";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { toast } from "@/components/ui/toast";

export type BillSyncMode = "none" | "draft" | "finalized";

type Props = {
  orderId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SyncInvoicePrompt({ orderId, open, onOpenChange }: Props) {
  const t = useTranslations("billing");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (pending && !next) return;
        onOpenChange(next);
      }}
      title={t("syncInvoiceTitle")}
      description={t("syncInvoiceConfirm")}
      confirmLabel={t("syncInvoiceYes")}
      cancelLabel={t("syncInvoiceNo")}
      loading={pending}
      onConfirm={() => {
        startTransition(async () => {
          const result = await syncInvoiceFromJobCardAction(orderId);
          if (result.ok) {
            toast.success(
              result.message === "invoiceSynced"
                ? t("invoiceSynced")
                : (result.message ?? t("invoiceSynced")),
            );
            onOpenChange(false);
            router.refresh();
            return;
          }
          toast.error(result.message ?? t("errors.invoiceCreateFailed"));
        });
      }}
    />
  );
}

/**
 * Draft bills sync quietly with the job card.
 * Finalized bills ask Yes/No before changing the locked paper.
 */
export function useInvoiceSyncPrompt(orderId: string, mode: BillSyncMode) {
  const t = useTranslations("billing");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  const offerSync = useCallback(() => {
    if (mode === "none") return;
    if (mode === "draft") {
      startTransition(async () => {
        const result = await syncInvoiceFromJobCardAction(orderId);
        if (result.ok) {
          router.refresh();
          return;
        }
        toast.error(result.message ?? t("errors.invoiceCreateFailed"));
      });
      return;
    }
    setOpen(true);
  }, [mode, orderId, router, t]);

  return { syncOpen: open, setSyncOpen: setOpen, offerSync };
}

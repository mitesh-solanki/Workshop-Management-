"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { deleteInvoiceAction } from "@/app/actions/billing";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { formatRupees } from "@/lib/money";

function boldAmount(chunks: ReactNode) {
  return (
    <strong className="font-bold text-slate-900">{chunks}</strong>
  );
}

type Props = {
  invoiceId: string;
  orderId: string;
  /** Icon-only trigger for the bill header. */
  iconOnly?: boolean;
  /** Payments collected on this bill (excludes refunds), in paise. */
  amountPaidPaise?: number;
  /** Credit notes total on this bill, in paise. */
  creditNotesTotalPaise?: number;
};

export function DeleteInvoiceForm({
  invoiceId,
  orderId,
  iconOnly = false,
  amountPaidPaise = 0,
  creditNotesTotalPaise = 0,
}: Props) {
  const t = useTranslations("billing");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const hasPayments = amountPaidPaise > 0;
  const hasCredits = creditNotesTotalPaise > 0;
  const hasMoney = hasPayments || hasCredits;

  const description = (() => {
    if (hasPayments && hasCredits) {
      return t.rich("deleteInvoiceWithMoneyConfirm", {
        paid: formatRupees(amountPaidPaise),
        credits: formatRupees(creditNotesTotalPaise),
        amount: boldAmount,
      });
    }
    if (hasPayments) {
      return t.rich("deleteInvoiceWithPaymentsConfirm", {
        paid: formatRupees(amountPaidPaise),
        amount: boldAmount,
      });
    }
    if (hasCredits) {
      return t.rich("deleteInvoiceWithCreditsConfirm", {
        credits: formatRupees(creditNotesTotalPaise),
        amount: boldAmount,
      });
    }
    return t("deleteInvoiceConfirm");
  })();

  function onConfirm() {
    startTransition(async () => {
      const result = await deleteInvoiceAction(
        orderId,
        invoiceId,
        { ok: false },
        new FormData(),
      );
      if (!result.ok) {
        toast.error(result.message ?? t("deleteInvoice"));
        return;
      }
      setOpen(false);
      toast.success(
        result.message === "invoiceDeleted" || result.message === "draftDeleted"
          ? t("invoiceDeleted")
          : (result.message ?? t("invoiceDeleted")),
      );
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={iconOnly ? "icon-sm" : "md"}
        disabled={pending}
        aria-label={t("deleteInvoice")}
        onClick={() => setOpen(true)}
        className={
          iconOnly
            ? "border-red-200 text-red-700 hover:border-red-300 hover:bg-red-50 hover:text-red-800"
            : "min-h-11 border-red-200 text-red-700 hover:border-red-300 hover:bg-red-50 hover:text-red-800"
        }
      >
        {iconOnly ? (
          <Trash2 className="size-4" aria-hidden />
        ) : pending ? (
          t("saving")
        ) : (
          t("deleteInvoice")
        )}
      </Button>

      <ConfirmDialog
        open={open}
        onOpenChange={(next) => {
          if (pending && !next) return;
          setOpen(next);
        }}
        title={t("deleteInvoiceTitle")}
        description={description}
        confirmLabel={
          hasMoney ? t("deleteInvoiceWithMoney") : t("deleteInvoice")
        }
        variant="danger"
        loading={pending && open}
        onConfirm={onConfirm}
      />
    </>
  );
}

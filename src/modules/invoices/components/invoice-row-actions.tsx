"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Eye, Trash2 } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
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
  serviceOrderId: string;
  amountPaidPaise?: number;
  creditNotesTotalPaise?: number;
};

export function InvoiceRowActions({
  invoiceId,
  serviceOrderId,
  amountPaidPaise = 0,
  creditNotesTotalPaise = 0,
}: Props) {
  const t = useTranslations("invoices");
  const tb = useTranslations("billing");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const hasPayments = amountPaidPaise > 0;
  const hasCredits = creditNotesTotalPaise > 0;
  const hasMoney = hasPayments || hasCredits;

  const description = (() => {
    if (hasPayments && hasCredits) {
      return tb.rich("deleteInvoiceWithMoneyConfirm", {
        paid: formatRupees(amountPaidPaise),
        credits: formatRupees(creditNotesTotalPaise),
        amount: boldAmount,
      });
    }
    if (hasPayments) {
      return tb.rich("deleteInvoiceWithPaymentsConfirm", {
        paid: formatRupees(amountPaidPaise),
        amount: boldAmount,
      });
    }
    if (hasCredits) {
      return tb.rich("deleteInvoiceWithCreditsConfirm", {
        credits: formatRupees(creditNotesTotalPaise),
        amount: boldAmount,
      });
    }
    return tb("deleteInvoiceConfirm");
  })();

  function onConfirm() {
    startTransition(async () => {
      const result = await deleteInvoiceAction(
        serviceOrderId,
        invoiceId,
        { ok: false },
        new FormData(),
      );
      if (!result.ok) {
        toast.error(result.message ?? tb("deleteInvoice"));
        return;
      }
      setOpen(false);
      toast.success(tb("invoiceDeleted"));
      router.refresh();
    });
  }

  return (
    <div
      className="flex items-center gap-1.5"
      data-row-stop
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <Button asChild variant="outline" size="icon-sm">
        <Link
          href={`/orders/${serviceOrderId}?section=billing`}
          aria-label={t("view")}
        >
          <Eye className="size-4" aria-hidden />
        </Link>
      </Button>

      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        disabled={pending}
        aria-label={tb("deleteInvoice")}
        onClick={() => setOpen(true)}
        className="border-red-200 text-red-700 hover:border-red-300 hover:bg-red-50 hover:text-red-800"
      >
        <Trash2 className="size-4" aria-hidden />
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={(next) => {
          if (pending && !next) return;
          setOpen(next);
        }}
        title={tb("deleteInvoiceTitle")}
        description={description}
        confirmLabel={
          hasMoney ? tb("deleteInvoiceWithMoney") : tb("deleteInvoice")
        }
        variant="danger"
        loading={pending && open}
        onConfirm={onConfirm}
      />
    </div>
  );
}

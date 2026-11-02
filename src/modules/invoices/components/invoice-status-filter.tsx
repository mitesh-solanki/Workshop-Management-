"use client";

import { useMemo, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { FormSelect } from "@/components/ui/form-select";
import { INVOICE_PAYMENT_STATUSES } from "@/modules/invoices/payment-status";

export function InvoiceStatusFilter() {
  const t = useTranslations("invoices");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const current = searchParams.get("status") ?? "";

  function setStatus(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next) {
      params.set("status", next);
    } else {
      params.delete("status");
    }
    params.delete("page");
    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `/invoices?${query}` : "/invoices");
    });
  }

  const options = useMemo(
    () => [
      { value: "", label: t("filters.all") },
      ...INVOICE_PAYMENT_STATUSES.map((status) => ({
        value: status,
        label: t(`paymentStatuses.${status}`),
      })),
    ],
    [t],
  );

  return (
    <div className="min-w-0">
      <label htmlFor="invoice-status-filter" className="sr-only">
        {t("filterStatusLabel")}
      </label>
      <FormSelect
        id="invoice-status-filter"
        value={current}
        onValueChange={setStatus}
        options={options}
        disabled={pending}
        className="w-auto min-w-42"
        triggerClassName="h-11 min-h-11 w-auto min-w-42 rounded-lg border-slate-200 bg-white px-3 text-[13px] font-semibold shadow-xs"
      />
    </div>
  );
}

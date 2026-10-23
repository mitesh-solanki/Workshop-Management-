"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
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

  const options: { value: string; label: string }[] = [
    { value: "", label: t("filters.all") },
    ...INVOICE_PAYMENT_STATUSES.map((status) => ({
      value: status,
      label: t(`paymentStatuses.${status}`),
    })),
  ];

  return (
    <div
      className="flex flex-wrap gap-1.5"
      role="group"
      aria-label={t("filterStatusLabel")}
      aria-busy={pending || undefined}
    >
      {options.map((option) => {
        const active = current === option.value;
        return (
          <button
            key={option.value || "all"}
            type="button"
            onClick={() => setStatus(option.value)}
            className={cn(
              "inline-flex min-h-11 items-center rounded-lg border px-3 text-[13px] font-semibold transition-colors",
              active
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-blue-700",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

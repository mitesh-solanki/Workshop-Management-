"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ListFiltersResetButton } from "@/components/ui/list-filters-reset-button";
import { MonthYearPicker } from "@/modules/payroll/components/month-year-picker";
import type { MyPayTab } from "@/modules/payroll/components/my-pay-tabs";

type Props = {
  activeTab: MyPayTab;
  yearMonth: string;
};

export function MyPayFilters({ activeTab, yearMonth }: Props) {
  const tc = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const filtersActive = yearMonth !== "all";

  function replaceParams(next: { month?: string; clearAll?: boolean }) {
    if (next.clearAll) {
      startTransition(() => {
        const params = new URLSearchParams();
        if (activeTab === "advance") params.set("tab", "advance");
        const qs = params.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname);
      });
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    if (activeTab === "salary") params.delete("tab");
    else params.set("tab", "advance");
    params.delete("q");

    const month = next.month ?? yearMonth;
    if (month === "all" || !month) params.delete("month");
    else params.set("month", month);

    startTransition(() => {
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  return (
    <div className="flex w-full flex-wrap items-center justify-end gap-1.5">
      <MonthYearPicker
        yearMonth={yearMonth}
        allowAll
        disabled={pending}
        onChange={(next) => replaceParams({ month: next })}
      />
      <ListFiltersResetButton
        label={tc("resetFilters")}
        disabled={!filtersActive || pending}
        onReset={() => replaceParams({ clearAll: true })}
      />
    </div>
  );
}

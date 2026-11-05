"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { FormSelect } from "@/components/ui/form-select";
import { cn } from "@/lib/utils";
import { currentYearMonth } from "@/modules/payroll/date";

const triggerClassName =
  "h-11 min-h-11 w-auto rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-semibold shadow-xs";

type Props = {
  yearMonth: string;
  disabled?: boolean;
  className?: string;
  /** When true, first month option is All Months (`all`). */
  allowAll?: boolean;
  onChange: (yearMonth: string) => void;
};

function parseYearMonth(yearMonth: string): { year: number; month: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(yearMonth.trim());
  if (!match) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }
  return { year: Number(match[1]), month: Number(match[2]) };
}

export function MonthYearPicker({
  yearMonth,
  disabled,
  className,
  allowAll = false,
  onChange,
}: Props) {
  const t = useTranslations("payroll");
  const locale = useLocale();
  const isAll = allowAll && yearMonth === "all";
  const { year, month } = parseYearMonth(
    isAll ? currentYearMonth() : yearMonth,
  );
  const currentYear = new Date().getFullYear();

  const monthOptions = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, index) => {
      const value = index + 1;
      const label = new Intl.DateTimeFormat(locale, { month: "long" }).format(
        new Date(Date.UTC(2020, index, 1)),
      );
      return {
        value: String(value).padStart(2, "0"),
        label,
      };
    });
    if (allowAll) {
      return [{ value: "all", label: t("filterAllMonths") }, ...months];
    }
    return months;
  }, [allowAll, locale, t]);

  const yearOptions = useMemo(() => {
    const years: { value: string; label: string }[] = [];
    for (let y = currentYear + 1; y >= currentYear - 10; y -= 1) {
      years.push({ value: String(y), label: String(y) });
    }
    if (!years.some((opt) => opt.value === String(year))) {
      years.unshift({ value: String(year), label: String(year) });
      years.sort((a, b) => Number(b.value) - Number(a.value));
    }
    return years;
  }, [currentYear, year]);

  const monthValue = isAll ? "all" : String(month).padStart(2, "0");
  const yearValue = String(year);

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <div className="w-fit shrink-0">
        <label htmlFor="payroll-month-select" className="sr-only">
          {t("filterMonth")}
        </label>
        <FormSelect
          id="payroll-month-select"
          value={monthValue}
          onValueChange={(nextMonth) => {
            if (nextMonth === "all") {
              onChange("all");
              return;
            }
            onChange(`${yearValue}-${nextMonth}`);
          }}
          options={monthOptions}
          className="w-fit"
          triggerClassName={cn(triggerClassName, "min-w-36")}
          disabled={disabled}
        />
      </div>
      {isAll ? null : (
        <div className="w-fit shrink-0">
          <label htmlFor="payroll-year-select" className="sr-only">
            {t("filterYear")}
          </label>
          <FormSelect
            id="payroll-year-select"
            value={yearValue}
            onValueChange={(nextYear) =>
              onChange(`${nextYear}-${monthValue}`)
            }
            options={yearOptions}
            className="w-fit"
            triggerClassName={cn(triggerClassName, "min-w-24")}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}

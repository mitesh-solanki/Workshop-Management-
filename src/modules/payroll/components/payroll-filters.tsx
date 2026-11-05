"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { FormSelect } from "@/components/ui/form-select";
import { ListFiltersResetButton } from "@/components/ui/list-filters-reset-button";
import { SearchInput } from "@/components/ui/search-input";
import { cn } from "@/lib/utils";
import { currentYearMonth } from "@/modules/payroll/date";
import { MonthYearPicker } from "@/modules/payroll/components/month-year-picker";

const DEBOUNCE_MS = 300;

const triggerClassName =
  "h-11 min-h-11 w-auto rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-semibold shadow-xs";

export type PayrollHubTab = "payroll" | "bonuses" | "advances";

type Props = {
  yearMonth: string;
  status?: "ALL" | "DRAFT" | "PAID";
  showStatus?: boolean;
  activeTab?: PayrollHubTab;
  showTabs?: boolean;
  /** Payroll tab defaults to all months; bonuses/advances stay month-scoped. */
  allowAllMonths?: boolean;
  className?: string;
};

export function PayrollFilters({
  yearMonth,
  status = "ALL",
  showStatus = false,
  activeTab = "payroll",
  showTabs = false,
  allowAllMonths = false,
  className,
}: Props) {
  const t = useTranslations("payroll");
  const tc = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const urlQuery = searchParams.get("q") ?? "";
  const [value, setValue] = useState(urlQuery);
  const [syncedUrlQuery, setSyncedUrlQuery] = useState(urlQuery);

  if (urlQuery !== syncedUrlQuery) {
    setSyncedUrlQuery(urlQuery);
    setValue(urlQuery);
  }

  const statusOptions = useMemo(
    () => [
      { value: "ALL", label: t("filterStatusAll") },
      { value: "DRAFT", label: t("unpaid") },
      { value: "PAID", label: t("paid") },
    ],
    [t],
  );

  const defaultMonth = allowAllMonths ? "all" : currentYearMonth();
  const filtersActive =
    Boolean(urlQuery.trim()) ||
    (showStatus && status !== "ALL") ||
    yearMonth !== defaultMonth ||
    activeTab !== "payroll";

  function tabHref(tab: PayrollHubTab) {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "payroll") {
      params.delete("tab");
      params.delete("month");
      params.delete("status");
    } else {
      params.set("tab", tab);
      const monthForTab =
        yearMonth !== "all" && /^\d{4}-\d{2}$/.test(yearMonth)
          ? yearMonth
          : currentYearMonth();
      params.set("month", monthForTab);
      params.delete("status");
    }
    params.delete("page");
    params.delete("create");
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function replaceParams(next: {
    month?: string;
    status?: string;
    q?: string;
    clearAll?: boolean;
  }) {
    if (next.clearAll) {
      startTransition(() => {
        router.replace(pathname);
      });
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    const month = next.month ?? yearMonth;
    if (month === "all" || !month) params.delete("month");
    else params.set("month", month);

    params.delete("member");

    if (activeTab === "payroll" || showStatus) {
      if (showStatus) {
        const nextStatus = next.status ?? status;
        if (nextStatus && nextStatus !== "ALL") params.set("status", nextStatus);
        else params.delete("status");
      }
    } else {
      params.delete("status");
    }

    if (activeTab === "payroll") params.delete("tab");
    else params.set("tab", activeTab);

    const q = next.q !== undefined ? next.q.trim() : urlQuery.trim();
    if (q) params.set("q", q);
    else params.delete("q");

    params.delete("create");
    params.delete("page");

    startTransition(() => {
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  useEffect(() => {
    const next = value.trim();
    const current = urlQuery.trim();
    if (next === current) return;
    const timer = window.setTimeout(() => {
      replaceParams({ q: next });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce typed search only
  }, [value, urlQuery]);

  return (
    <div
      className={cn(
        "flex w-full flex-wrap items-center gap-2",
        className,
      )}
    >
      <SearchInput
        id="payroll-search"
        value={value}
        onValueChange={setValue}
        label={t("searchLabel")}
        placeholder={t("searchPlaceholder")}
        className="w-full min-w-0 sm:max-w-72 md:max-w-80"
        aria-busy={pending || undefined}
      />
      <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-1.5 sm:w-auto">
        <MonthYearPicker
          yearMonth={yearMonth}
          allowAll={allowAllMonths}
          disabled={pending}
          onChange={(next) => replaceParams({ month: next })}
        />
        {showStatus ? (
          <div className="w-fit shrink-0">
            <label htmlFor="payroll-status-filter" className="sr-only">
              {t("columns.status")}
            </label>
            <FormSelect
              id="payroll-status-filter"
              value={status}
              onValueChange={(next) =>
                replaceParams({ status: next as "ALL" | "DRAFT" | "PAID" })
              }
              options={statusOptions}
              className="w-fit"
              triggerClassName={triggerClassName}
              disabled={pending}
            />
          </div>
        ) : null}
        {showTabs ? (
          <div
            className="inline-flex h-11 items-center rounded-lg border border-slate-200 bg-slate-100 p-1"
            role="tablist"
            aria-label={t("hubTabsLabel")}
          >
            {(
              [
                { id: "payroll" as const, label: t("tabs.payroll") },
                { id: "bonuses" as const, label: t("tabs.bonuses") },
                { id: "advances" as const, label: t("tabs.advances") },
              ] as const
            ).map((tab) => {
              const active = activeTab === tab.id;
              return (
                <Link
                  key={tab.id}
                  href={tabHref(tab.id)}
                  role="tab"
                  aria-selected={active}
                  className={cn(
                    "inline-flex h-9 items-center rounded-md px-3 text-[13px] font-semibold transition-colors",
                    active
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900",
                  )}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        ) : null}
        <ListFiltersResetButton
          label={tc("resetFilters")}
          disabled={!filtersActive || pending}
          onReset={() => {
            setValue("");
            replaceParams({ clearAll: true });
          }}
        />
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ListFiltersResetButton } from "@/components/ui/list-filters-reset-button";
import { ListSortMenu } from "@/components/ui/list-sort-menu";
import { FormSelect } from "@/components/ui/form-select";
import { SearchInput } from "@/components/ui/search-input";
import { cn } from "@/lib/utils";
import {
  EXPENSE_SORTS,
  EXPENSE_STATUSES,
  type ExpenseSort,
} from "@/modules/expenses/schema";

const DEBOUNCE_MS = 300;

const SORT_LABEL_KEYS: Record<
  ExpenseSort,
  "newest" | "oldest" | "amountDesc" | "amountAsc"
> = {
  newest: "newest",
  oldest: "oldest",
  amount_desc: "amountDesc",
  amount_asc: "amountAsc",
};

function isExpenseSort(value: string): value is ExpenseSort {
  return (EXPENSE_SORTS as readonly string[]).includes(value);
}

type Props = {
  className?: string;
  actions?: React.ReactNode;
};

export function ExpenseSearch({ className, actions }: Props) {
  const t = useTranslations("expenses");
  const tc = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const urlQuery = searchParams.get("q") ?? "";
  const urlStatus = searchParams.get("status") ?? "ALL";
  const urlSortRaw = searchParams.get("sort") ?? "newest";
  const urlSort: ExpenseSort = isExpenseSort(urlSortRaw)
    ? urlSortRaw
    : "newest";
  const [value, setValue] = useState(urlQuery);
  const [syncedUrlQuery, setSyncedUrlQuery] = useState(urlQuery);
  const filtersActive =
    Boolean(urlQuery.trim()) ||
    urlSort !== "newest" ||
    (urlStatus !== "ALL" && urlStatus !== "");

  if (urlQuery !== syncedUrlQuery) {
    setSyncedUrlQuery(urlQuery);
    setValue(urlQuery);
  }

  const statusOptions = useMemo(
    () => [
      { value: "ALL", label: t("filters.all") },
      ...EXPENSE_STATUSES.map((status) => ({
        value: status,
        label: t(`statuses.${status}`),
      })),
    ],
    [t],
  );

  const sortOptions = useMemo(
    () =>
      EXPENSE_SORTS.map((sort) => ({
        value: sort,
        label: t(`sort.${SORT_LABEL_KEYS[sort]}`),
      })),
    [t],
  );

  function replaceParams(next: {
    q?: string;
    status?: string;
    sort?: ExpenseSort;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    const q = next.q !== undefined ? next.q.trim() : urlQuery.trim();
    const status = next.status ?? urlStatus;
    const sort = next.sort ?? urlSort;

    if (q) {
      params.set("q", q);
    } else {
      params.delete("q");
    }

    params.delete("category");

    if (status && status !== "ALL") {
      params.set("status", status);
    } else {
      params.delete("status");
    }

    if (sort === "newest") {
      params.delete("sort");
    } else {
      params.set("sort", sort);
    }

    params.delete("page");
    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `/expenses?${query}` : "/expenses");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce only on typed value
  }, [value, urlQuery]);

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:gap-3",
        className,
      )}
    >
      <div className="min-w-0 w-full flex-1 sm:max-w-md">
        <SearchInput
          id="expense-search"
          value={value}
          onValueChange={setValue}
          label={t("searchLabel")}
          placeholder={t("searchPlaceholder")}
          aria-busy={pending || undefined}
        />
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:ml-auto">
        {actions}
        <div className="min-w-0">
          <label htmlFor="expense-status-filter" className="sr-only">
            {t("filterStatusLabel")}
          </label>
          <FormSelect
            id="expense-status-filter"
            value={urlStatus}
            onValueChange={(status) => replaceParams({ status })}
            options={statusOptions}
            disabled={pending}
            className="w-auto min-w-42"
            triggerClassName="h-11 min-h-11 w-auto min-w-42 rounded-lg border-slate-200 bg-white px-3 text-[13px] font-semibold shadow-xs"
          />
        </div>
        <ListSortMenu
          value={urlSort}
          options={sortOptions}
          onChange={(sort) => replaceParams({ sort })}
          ariaLabel={t("sortLabel")}
          disabled={pending}
        />
        <ListFiltersResetButton
          label={tc("resetFilters")}
          disabled={!filtersActive || pending}
          onReset={() => {
            setValue("");
            startTransition(() => {
              router.replace("/expenses");
            });
          }}
        />
      </div>
    </div>
  );
}

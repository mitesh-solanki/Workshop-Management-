"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { FormSelect } from "@/components/ui/form-select";
import { ListFiltersResetButton } from "@/components/ui/list-filters-reset-button";
import { ListSortMenu } from "@/components/ui/list-sort-menu";
import { SearchInput } from "@/components/ui/search-input";
import { cn } from "@/lib/utils";
import {
  INSPECTION_APPROVAL_STATUSES,
  type InspectionApprovalStatus,
} from "@/modules/inspections/approval-status";
import {
  INSPECTION_SORTS,
  type InspectionSort,
} from "@/modules/inspections/schema";

const DEBOUNCE_MS = 300;

const SORT_LABEL_KEYS: Record<
  InspectionSort,
  "newest" | "oldest" | "registrationAsc" | "registrationDesc" | "customerAsc"
> = {
  newest: "newest",
  oldest: "oldest",
  registration_asc: "registrationAsc",
  registration_desc: "registrationDesc",
  customer_asc: "customerAsc",
};

function isInspectionSort(value: string): value is InspectionSort {
  return (INSPECTION_SORTS as readonly string[]).includes(value);
}

function isApprovalStatus(value: string): value is InspectionApprovalStatus {
  return (INSPECTION_APPROVAL_STATUSES as readonly string[]).includes(value);
}

type Props = {
  className?: string;
  actions?: React.ReactNode;
};

export function InspectionSearch({ className, actions }: Props) {
  const t = useTranslations("inspections");
  const tc = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const urlQuery = searchParams.get("q") ?? "";
  const urlStatusRaw = searchParams.get("status") ?? "ALL";
  const urlStatus =
    urlStatusRaw === "ALL" || isApprovalStatus(urlStatusRaw)
      ? urlStatusRaw
      : "ALL";
  const urlSortRaw = searchParams.get("sort") ?? "newest";
  const urlSort: InspectionSort = isInspectionSort(urlSortRaw)
    ? urlSortRaw
    : "newest";
  const [value, setValue] = useState(urlQuery);
  const [syncedUrlQuery, setSyncedUrlQuery] = useState(urlQuery);
  const filtersActive =
    Boolean(urlQuery.trim()) ||
    urlSort !== "newest" ||
    urlStatus !== "ALL";

  if (urlQuery !== syncedUrlQuery) {
    setSyncedUrlQuery(urlQuery);
    setValue(urlQuery);
  }

  const statusOptions = useMemo(
    () => [
      { value: "ALL", label: t("filters.all") },
      ...INSPECTION_APPROVAL_STATUSES.map((status) => ({
        value: status,
        label: t(`approvalStatus.${status}`),
      })),
    ],
    [t],
  );

  const sortOptions = useMemo(
    () =>
      INSPECTION_SORTS.map((sort) => ({
        value: sort,
        label: t(`sort.${SORT_LABEL_KEYS[sort]}`),
      })),
    [t],
  );

  function replaceParams(next: {
    q?: string;
    status?: string;
    sort?: InspectionSort;
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
      router.replace(query ? `/inspections?${query}` : "/inspections");
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
        "flex w-full flex-wrap items-center justify-between gap-2",
        className,
      )}
    >
      <SearchInput
        id="inspection-search"
        value={value}
        onValueChange={setValue}
        label={t("searchLabel")}
        placeholder={t("searchPlaceholder")}
        className="w-full min-w-0 flex-1 md:max-w-md"
        aria-busy={pending || undefined}
      />
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {actions}
        <div className="min-w-0">
          <label htmlFor="inspection-status-filter" className="sr-only">
            {t("filterStatusLabel")}
          </label>
          <FormSelect
            id="inspection-status-filter"
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
              router.replace("/inspections");
            });
          }}
        />
      </div>
    </div>
  );
}

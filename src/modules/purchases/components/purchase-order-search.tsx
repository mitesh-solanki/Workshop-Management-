"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ListSortMenu } from "@/components/ui/list-sort-menu";
import { SearchInput } from "@/components/ui/search-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  PURCHASE_ORDER_SORTS,
  PURCHASE_ORDER_STATUSES,
  type PurchaseOrderSort,
} from "@/modules/purchases/schema";

const DEBOUNCE_MS = 300;

function isPurchaseOrderSort(value: string): value is PurchaseOrderSort {
  return (PURCHASE_ORDER_SORTS as readonly string[]).includes(value);
}

type PurchaseOrderSearchProps = {
  className?: string;
  actions?: React.ReactNode;
};

export function PurchaseOrderSearch({
  className,
  actions,
}: PurchaseOrderSearchProps) {
  const t = useTranslations("purchaseOrders");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const urlQuery = searchParams.get("q") ?? "";
  const urlStatus = searchParams.get("status") ?? "ALL";
  const urlSortRaw = searchParams.get("sort") ?? "newest";
  const urlSort: PurchaseOrderSort = isPurchaseOrderSort(urlSortRaw)
    ? urlSortRaw
    : "newest";
  const [value, setValue] = useState(urlQuery);
  const [syncedUrlQuery, setSyncedUrlQuery] = useState(urlQuery);

  if (urlQuery !== syncedUrlQuery) {
    setSyncedUrlQuery(urlQuery);
    setValue(urlQuery);
  }

  const statusOptions = useMemo(
    () => [
      { value: "ALL", label: t("filters.all") },
      ...PURCHASE_ORDER_STATUSES.map((status) => ({
        value: status,
        label: t(`statuses.${status}`),
      })),
    ],
    [t],
  );

  const sortOptions = useMemo(
    () =>
      PURCHASE_ORDER_SORTS.map((sort) => ({
        value: sort,
        label: t(`sort.${sort}`),
      })),
    [t],
  );

  function replaceParams(next: {
    q?: string;
    status?: string;
    sort?: PurchaseOrderSort;
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
    params.delete("requestId");
    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `/purchase-orders?${query}` : "/purchase-orders");
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

  const statusPills = (
    <div
      className="flex flex-wrap gap-1.5"
      role="group"
      aria-label={t("filterStatusLabel")}
      aria-busy={pending || undefined}
    >
      {statusOptions.map((option) => {
        const active = urlStatus === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => replaceParams({ status: option.value })}
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

  const sortMenu = (
    <ListSortMenu
      value={urlSort}
      options={sortOptions}
      onChange={(sort) => replaceParams({ sort })}
      ariaLabel={t("sortLabel")}
      disabled={pending}
    />
  );

  return (
    <div className={cn("flex w-full flex-col gap-3", className)}>
      <div className="flex w-full flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 w-full max-w-md">
          <SearchInput
            id="purchase-order-search"
            value={value}
            onValueChange={setValue}
            label={t("searchLabel")}
            placeholder={t("searchPlaceholder")}
            aria-busy={pending || undefined}
          />
        </div>
        <div className="hidden flex-wrap items-center justify-end gap-2 md:flex">
          {actions}
          {statusPills}
          {sortMenu}
        </div>
      </div>

      <div className="flex w-full items-center gap-2 md:hidden">
        <Select
          value={urlStatus}
          onValueChange={(status) => replaceParams({ status })}
          disabled={pending}
        >
          <SelectTrigger
            className="min-h-11 w-full min-w-0 flex-1"
            aria-label={t("filterStatusLabel")}
            aria-busy={pending || undefined}
          >
            <SelectValue placeholder={t("filters.all")} />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {sortMenu}
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}

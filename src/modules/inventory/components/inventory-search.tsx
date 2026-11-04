"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ListFiltersResetButton } from "@/components/ui/list-filters-reset-button";
import { ListSortMenu } from "@/components/ui/list-sort-menu";
import { SearchInput } from "@/components/ui/search-input";
import { cn } from "@/lib/utils";
import { PART_SORTS, type PartSort } from "@/modules/inventory/schema";

const DEBOUNCE_MS = 300;

const SORT_LABEL_KEYS: Record<
  PartSort,
  "newest" | "oldest" | "updated" | "nameAsc" | "nameDesc"
> = {
  newest: "newest",
  oldest: "oldest",
  updated: "updated",
  name_asc: "nameAsc",
  name_desc: "nameDesc",
};

function isPartSort(value: string): value is PartSort {
  return (PART_SORTS as readonly string[]).includes(value);
}

type Props = {
  className?: string;
};

export function InventorySearch({ className }: Props) {
  const t = useTranslations("inventory");
  const tc = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const urlQuery = searchParams.get("q") ?? "";
  const urlSortRaw = searchParams.get("sort") ?? "newest";
  const urlSort: PartSort = isPartSort(urlSortRaw) ? urlSortRaw : "newest";
  const lowStockOnly = searchParams.get("stock") === "low";
  const [value, setValue] = useState(urlQuery);
  const [syncedUrlQuery, setSyncedUrlQuery] = useState(urlQuery);
  const filtersActive =
    Boolean(urlQuery.trim()) || urlSort !== "newest" || lowStockOnly;

  if (urlQuery !== syncedUrlQuery) {
    setSyncedUrlQuery(urlQuery);
    setValue(urlQuery);
  }

  const sortOptions = useMemo(
    () =>
      PART_SORTS.map((sort) => ({
        value: sort,
        label: t(`sort.${SORT_LABEL_KEYS[sort]}`),
      })),
    [t],
  );

  function replaceParams(next: {
    q?: string;
    sort?: PartSort;
    stock?: "low" | "";
  }) {
    const params = new URLSearchParams(searchParams.toString());
    const q = next.q !== undefined ? next.q.trim() : urlQuery.trim();
    const sort = next.sort ?? urlSort;
    const stock =
      next.stock !== undefined
        ? next.stock
        : lowStockOnly
          ? "low"
          : "";

    if (q) {
      params.set("q", q);
    } else {
      params.delete("q");
    }

    if (sort === "newest") {
      params.delete("sort");
    } else {
      params.set("sort", sort);
    }

    if (stock === "low") {
      params.set("stock", "low");
    } else {
      params.delete("stock");
    }

    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `/inventory?${query}` : "/inventory");
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
        "flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3",
        className,
      )}
    >
      <div className="min-w-0 w-full max-w-md flex-1">
        <SearchInput
          id="inventory-search"
          value={value}
          onValueChange={setValue}
          label={t("searchLabel")}
          placeholder={t("searchPlaceholder")}
          aria-busy={pending || undefined}
        />
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 self-end sm:self-auto">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            replaceParams({ stock: lowStockOnly ? "" : "low" })
          }
          className={cn(
            "inline-flex h-11 min-h-11 items-center rounded-lg border px-3 text-[13px] font-semibold transition",
            lowStockOnly
              ? "border-blue-600 bg-blue-50 text-blue-800"
              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
          )}
        >
          {t("filterLowStock")}
        </button>
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
              router.replace("/inventory");
            });
          }}
        />
      </div>
    </div>
  );
}

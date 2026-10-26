"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ListSortMenu } from "@/components/ui/list-sort-menu";
import { SearchInput } from "@/components/ui/search-input";
import { cn } from "@/lib/utils";
import {
  VEHICLE_SORTS,
  type VehicleSort,
} from "@/modules/vehicles/schema";

const DEBOUNCE_MS = 300;

const SORT_LABEL_KEYS: Record<
  VehicleSort,
  "newest" | "updated" | "nameAsc" | "nameDesc"
> = {
  newest: "newest",
  updated: "updated",
  name_asc: "nameAsc",
  name_desc: "nameDesc",
};

function isVehicleSort(value: string): value is VehicleSort {
  return (VEHICLE_SORTS as readonly string[]).includes(value);
}

type VehicleSearchProps = {
  className?: string;
  /** Primary list actions shown to the right of search (import, add, …). */
  actions?: React.ReactNode;
};

export function VehicleSearch({ className, actions }: VehicleSearchProps) {
  const t = useTranslations("vehicles");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const urlQuery = searchParams.get("q") ?? "";
  const urlSortRaw = searchParams.get("sort") ?? "name_asc";
  const urlSort: VehicleSort = isVehicleSort(urlSortRaw)
    ? urlSortRaw
    : "name_asc";
  const [value, setValue] = useState(urlQuery);
  const [syncedUrlQuery, setSyncedUrlQuery] = useState(urlQuery);

  if (urlQuery !== syncedUrlQuery) {
    setSyncedUrlQuery(urlQuery);
    setValue(urlQuery);
  }

  const sortOptions = useMemo(
    () =>
      VEHICLE_SORTS.map((sort) => ({
        value: sort,
        label: t(`sort.${SORT_LABEL_KEYS[sort]}`),
      })),
    [t],
  );

  function replaceParams(next: { q?: string; sort?: VehicleSort }) {
    const params = new URLSearchParams(searchParams.toString());
    const q = next.q !== undefined ? next.q.trim() : urlQuery.trim();
    const sort = next.sort ?? urlSort;

    if (q) {
      params.set("q", q);
    } else {
      params.delete("q");
    }

    if (sort === "name_asc") {
      params.delete("sort");
    } else {
      params.set("sort", sort);
    }

    params.delete("page");
    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `/vehicles?${query}` : "/vehicles");
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
        "flex w-full flex-col gap-2 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 w-full max-w-md">
        <SearchInput
          id="vehicle-search"
          value={value}
          onValueChange={setValue}
          label={t("searchLabel")}
          placeholder={t("searchPlaceholder")}
          aria-busy={pending || undefined}
        />
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {actions}
        <ListSortMenu
          value={urlSort}
          options={sortOptions}
          onChange={(sort) => replaceParams({ sort })}
          ariaLabel={t("sortLabel")}
          disabled={pending}
        />
      </div>
    </div>
  );
}

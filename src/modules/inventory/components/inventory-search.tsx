"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ListSortMenu } from "@/components/ui/list-sort-menu";
import { SearchInput } from "@/components/ui/search-input";
import { cn } from "@/lib/utils";
import { PART_SORTS, type PartSort } from "@/modules/inventory/schema";

const DEBOUNCE_MS = 300;

const SORT_LABEL_KEYS: Record<
  PartSort,
  "newest" | "updated" | "nameAsc" | "nameDesc"
> = {
  newest: "newest",
  updated: "updated",
  name_asc: "nameAsc",
  name_desc: "nameDesc",
};

function isPartSort(value: string): value is PartSort {
  return (PART_SORTS as readonly string[]).includes(value);
}

type Props = {
  className?: string;
  canSale?: boolean;
};

export function InventorySearch({ className, canSale = false }: Props) {
  const t = useTranslations("inventory");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const urlQuery = searchParams.get("q") ?? "";
  const urlSortRaw = searchParams.get("sort") ?? "name_asc";
  const urlSort: PartSort = isPartSort(urlSortRaw) ? urlSortRaw : "name_asc";
  const [value, setValue] = useState(urlQuery);
  const [syncedUrlQuery, setSyncedUrlQuery] = useState(urlQuery);

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

  function replaceParams(next: { q?: string; sort?: PartSort }) {
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
      <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
        {canSale ? (
          <>
            <div className="hidden items-center gap-2 sm:flex">
              <Button asChild variant="secondary" size="md">
                <Link href="/inventory/sales">{t("viewSales")}</Link>
              </Button>
              <Button asChild variant="secondary" size="md">
                <Link href="/inventory/sales/new">{t("directSale")}</Link>
              </Button>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  disabled={pending}
                  className="min-h-11 sm:hidden"
                  aria-label={t("salesActionsLabel")}
                >
                  {t("salesActionsLabel")}
                  <ChevronDown className="size-4 opacity-50" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[12rem]">
                <DropdownMenuItem
                  className="min-h-10"
                  disabled={pending}
                  onSelect={() => {
                    startTransition(() => {
                      router.push("/inventory/sales");
                    });
                  }}
                >
                  {t("viewSales")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="min-h-10"
                  disabled={pending}
                  onSelect={() => {
                    startTransition(() => {
                      router.push("/inventory/sales/new");
                    });
                  }}
                >
                  {t("directSale")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : null}
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

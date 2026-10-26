"use client";

import { useMemo, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ListSortMenu } from "@/components/ui/list-sort-menu";
import {
  INVOICE_SORTS,
  type InvoiceSort,
} from "@/modules/invoices/schema";

function isInvoiceSort(value: string): value is InvoiceSort {
  return (INVOICE_SORTS as readonly string[]).includes(value);
}

export function InvoiceSortMenu() {
  const t = useTranslations("invoices");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const urlSortRaw = searchParams.get("sort") ?? "newest";
  const urlSort: InvoiceSort = isInvoiceSort(urlSortRaw)
    ? urlSortRaw
    : "newest";

  const sortOptions = useMemo(
    () =>
      INVOICE_SORTS.map((sort) => ({
        value: sort,
        label: t(`sort.${sort}`),
      })),
    [t],
  );

  function setSort(sort: InvoiceSort) {
    const params = new URLSearchParams(searchParams.toString());
    if (sort === "newest") {
      params.delete("sort");
    } else {
      params.set("sort", sort);
    }
    params.delete("page");
    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `/invoices?${query}` : "/invoices");
    });
  }

  return (
    <ListSortMenu
      value={urlSort}
      options={sortOptions}
      onChange={setSort}
      ariaLabel={t("sortLabel")}
      disabled={pending}
    />
  );
}

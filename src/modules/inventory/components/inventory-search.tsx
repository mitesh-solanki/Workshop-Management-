"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { SearchInput } from "@/components/ui/search-input";

const DEBOUNCE_MS = 300;

type Props = {
  className?: string;
};

export function InventorySearch({ className }: Props) {
  const t = useTranslations("inventory");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const urlQuery = searchParams.get("q") ?? "";
  const [value, setValue] = useState(urlQuery);
  const [syncedUrlQuery, setSyncedUrlQuery] = useState(urlQuery);

  if (urlQuery !== syncedUrlQuery) {
    setSyncedUrlQuery(urlQuery);
    setValue(urlQuery);
  }

  useEffect(() => {
    const next = value.trim();
    const current = urlQuery.trim();
    if (next === current) return;

    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (next) {
        params.set("q", next);
      } else {
        params.delete("q");
      }
      const query = params.toString();
      startTransition(() => {
        router.replace(query ? `/inventory?${query}` : "/inventory");
      });
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [value, urlQuery, router, searchParams]);

  return (
    <SearchInput
      id="inventory-search"
      value={value}
      onValueChange={setValue}
      label={t("searchLabel")}
      placeholder={t("searchPlaceholder")}
      className={className}
    />
  );
}

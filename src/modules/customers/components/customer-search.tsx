"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { SearchInput } from "@/components/ui/search-input";

const DEBOUNCE_MS = 300;

type CustomerSearchProps = {
  className?: string;
};

export function CustomerSearch({ className }: CustomerSearchProps) {
  const t = useTranslations("customers");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const urlQuery = searchParams.get("q") ?? "";
  const [value, setValue] = useState(urlQuery);
  const [syncedUrlQuery, setSyncedUrlQuery] = useState(urlQuery);

  // Keep input in sync when the URL changes (back/forward, clear).
  // Adjust during render — avoids setState-in-effect cascading renders.
  if (urlQuery !== syncedUrlQuery) {
    setSyncedUrlQuery(urlQuery);
    setValue(urlQuery);
  }

  // Debounced search — no Enter required.
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
      // New query always starts at page 1.
      params.delete("page");
      const query = params.toString();
      startTransition(() => {
        router.replace(query ? `/customers?${query}` : "/customers");
      });
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [value, urlQuery, router, searchParams]);

  return (
    <div className={className ?? "w-full"}>
      <SearchInput
        id="customer-search"
        value={value}
        onValueChange={setValue}
        label={t("searchLabel")}
        placeholder={t("searchPlaceholder")}
        aria-busy={pending || undefined}
      />
    </div>
  );
}

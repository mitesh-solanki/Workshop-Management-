"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { SearchInput } from "@/components/ui/search-input";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 300;

type BaySearchProps = {
  className?: string;
  actions?: React.ReactNode;
};

export function BaySearch({ className, actions }: BaySearchProps) {
  const t = useTranslations("bays");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const urlQuery = searchParams.get("q") ?? "";
  const [value, setValue] = useState(urlQuery);
  const [syncedUrlQuery, setSyncedUrlQuery] = useState(urlQuery);

  if (urlQuery !== syncedUrlQuery) {
    setSyncedUrlQuery(urlQuery);
    setValue(urlQuery);
  }

  function replaceParams(nextQ: string) {
    const params = new URLSearchParams(searchParams.toString());
    const q = nextQ.trim();
    if (q) {
      params.set("q", q);
    } else {
      params.delete("q");
    }
    params.delete("page");
    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `/bays?${query}` : "/bays");
    });
  }

  useEffect(() => {
    const next = value.trim();
    const current = urlQuery.trim();
    if (next === current) return;

    const timer = window.setTimeout(() => {
      replaceParams(next);
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
          id="bay-search"
          value={value}
          onValueChange={setValue}
          label={t("searchLabel")}
          placeholder={t("searchPlaceholder")}
          aria-busy={pending || undefined}
        />
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

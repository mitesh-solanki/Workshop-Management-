"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";

const inputClass =
  "min-h-12 w-full rounded-md border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function CustomerSearch() {
  const t = useTranslations("customers");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const current = searchParams.get("q") ?? "";

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const q = String(formData.get("q") ?? "").trim();
        const params = new URLSearchParams();
        if (q) {
          params.set("q", q);
        }
        const href = params.size > 0 ? `/customers?${params}` : "/customers";
        startTransition(() => {
          router.push(href);
        });
      }}
    >
      <label htmlFor="q" className="sr-only">
        {t("searchLabel")}
      </label>
      <input
        id="q"
        name="q"
        type="search"
        defaultValue={current}
        placeholder={t("searchPlaceholder")}
        className={inputClass}
        enterKeyHint="search"
      />
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 rounded-md border px-4 text-base font-medium disabled:opacity-60"
      >
        {pending ? t("searching") : t("search")}
      </button>
    </form>
  );
}

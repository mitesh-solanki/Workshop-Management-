"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { setLocale } from "@/app/actions/locale";
import { locales, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

const labels: Record<Locale, string> = {
  en: "EN",
  hi: "हि",
  gu: "ગુ",
};

export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useTranslations("language");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div
      className={cn("flex items-center gap-1", className)}
      role="group"
      aria-label={t("label")}
    >
      {locales.map((code) => (
        <button
          key={code}
          type="button"
          disabled={pending || code === locale}
          className={cn(
            "min-h-11 min-w-11 rounded-md px-2 text-sm font-medium",
            code === locale
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground",
          )}
          onClick={() => {
            startTransition(async () => {
              await setLocale(code);
              router.refresh();
            });
          }}
        >
          {labels[code]}
        </button>
      ))}
    </div>
  );
}

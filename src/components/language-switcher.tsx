"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Languages } from "lucide-react";
import { setLocale } from "@/app/actions/locale";
import { locales, type Locale } from "@/i18n/config";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type LanguageSwitcherProps = {
  className?: string;
  compact?: boolean;
};

export function LanguageSwitcher({
  className,
  compact = false,
}: LanguageSwitcherProps) {
  const t = useTranslations("language");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size={compact ? "icon-sm" : "md"}
          disabled={pending}
          aria-label={t("label")}
          className={cn(className)}
        >
          <Languages className="size-4 shrink-0" aria-hidden />
          {!compact ? (
            <span className="max-w-[7rem] truncate">{t(locale)}</span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[12rem]">
        {locales.map((code) => {
          const selected = code === locale;
          return (
            <DropdownMenuItem
              key={code}
              disabled={pending || selected}
              className="min-h-10 justify-between"
              onSelect={() => {
                startTransition(async () => {
                  await setLocale(code);
                  router.refresh();
                });
              }}
            >
              <span>{t(code)}</span>
              {selected ? (
                <Check className="size-4 shrink-0" aria-hidden />
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

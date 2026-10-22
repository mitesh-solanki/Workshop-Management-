"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

type SpinnerProps = {
  className?: string;
  /** When omitted, only the animated icon is shown (safe outside intl). */
  label?: string;
};

/** Presentational spinner — safe outside the intl provider when label is omitted. */
export function Spinner({ className, label }: SpinnerProps) {
  return (
    <div
      className={cn(
        "flex min-h-[12rem] flex-1 flex-col items-center justify-center gap-3 py-16",
        className,
      )}
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={label}
    >
      <Loader2
        className="size-8 animate-spin text-primary motion-reduce:animate-none"
        aria-hidden
      />
      {label ? (
        <span className="text-sm text-muted-foreground">{label}</span>
      ) : null}
    </div>
  );
}

/** Spinner with translated “Loading…” — use inside NextIntlClientProvider. */
export function PageSpinner({ className }: { className?: string }) {
  const t = useTranslations("common");
  return <Spinner className={className} label={t("loading")} />;
}

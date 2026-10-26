"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardBody } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type SpinnerProps = {
  className?: string;
  /** When omitted, only the animated icon is shown (safe outside intl). */
  label?: string;
};

/** Full-pane spinner (route / shell loading). Fills parent; no viewport min-height. */
export function Spinner({ className, label }: SpinnerProps) {
  return (
    <div
      className={cn(
        "flex min-h-full w-full flex-1 flex-col items-center justify-center gap-3",
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

/**
 * Compact loader for list/table Suspense — same footprint as EmptyState
 * (dashed card, py-10). Does not stretch the page.
 */
export function TableSpinner({ className }: { className?: string }) {
  const t = useTranslations("common");
  return (
    <Card
      className={cn("border-dashed py-0 shadow-sm", className)}
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={t("loading")}
    >
      <CardBody className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
        <Loader2
          className="size-8 animate-spin text-primary motion-reduce:animate-none"
          aria-hidden
        />
        <span className="text-sm text-muted-foreground">{t("loading")}</span>
      </CardBody>
    </Card>
  );
}

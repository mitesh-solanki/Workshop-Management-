"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  dateKey: string;
};

export function DailySummaryToolbar({ dateKey }: Props) {
  const t = useTranslations("dailySummary");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
      <label htmlFor="daily-summary-date" className="sr-only">
        {t("dateLabel")}
      </label>
      <Input
        id="daily-summary-date"
        type="date"
        value={dateKey}
        disabled={pending}
        aria-label={t("dateLabel")}
        onChange={(event) => {
          const next = event.target.value;
          if (!next) return;
          startTransition(() => {
            router.push(`/daily-summary?date=${encodeURIComponent(next)}`);
          });
        }}
        className="h-11 min-h-11 w-[11.5rem] max-w-full"
      />
      <Button asChild size="md" className="min-h-11">
        <a href={`/daily-summary/pdf?date=${encodeURIComponent(dateKey)}`}>
          <Download className="size-4" aria-hidden />
          {t("downloadPdf")}
        </a>
      </Button>
    </div>
  );
}

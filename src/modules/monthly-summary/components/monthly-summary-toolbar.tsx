"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  buildMonthlySummaryCsv,
  monthlySummaryCsvFilename,
} from "@/modules/monthly-summary/csv";
import type { MonthlySummaryView } from "@/modules/monthly-summary/types";
import { MonthYearPicker } from "@/modules/payroll/components/month-year-picker";

type Props = {
  summary: MonthlySummaryView;
};

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function MonthlySummaryToolbar({ summary }: Props) {
  const t = useTranslations("monthlySummary");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [exporting, setExporting] = useState(false);

  return (
    <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
      <MonthYearPicker
        yearMonth={summary.yearMonth}
        disabled={pending || exporting}
        onChange={(next) => {
          startTransition(() => {
            router.push(`/monthly-summary?month=${encodeURIComponent(next)}`);
          });
        }}
      />
      <Button
        type="button"
        size="md"
        className="min-h-11"
        disabled={exporting || summary.isEmpty}
        onClick={() => {
          setExporting(true);
          try {
            downloadCsv(
              monthlySummaryCsvFilename(summary.yearMonth),
              buildMonthlySummaryCsv(summary),
            );
          } finally {
            setExporting(false);
          }
        }}
      >
        <Download className="size-4" aria-hidden />
        {t("downloadCsv")}
      </Button>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { loadMoneyReportCardAction } from "@/app/actions/reports";
import { ReportChart } from "@/modules/reports/components/report-chart";
import { ReportCardShell } from "@/modules/reports/components/report-card-shell";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/ui/form-select";
import { sanitizeCsvFilename } from "@/lib/csv";
import { formatRupees } from "@/lib/money";
import { buildMoneyReportCsv } from "@/modules/reports/money-export";
import {
  toMoneyReportCardState,
  type MoneyReportCardState,
} from "@/modules/reports/money-card-state";
import {
  REPORT_PERIODS,
  type ReportPeriod,
} from "@/modules/reports/schema";

type Props = {
  initialCard: MoneyReportCardState;
  exportUserSlug: string;
  garageGstin: string | null;
};

const ACCENT: Record<MoneyReportCardState["key"], string> = {
  sales: "text-slate-900",
  payments: "text-emerald-700",
  outstanding: "text-amber-700",
  creditNotes: "text-violet-700",
};

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = sanitizeCsvFilename(filename);
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ReportCard({
  initialCard,
  exportUserSlug,
  garageGstin,
}: Props) {
  const t = useTranslations("reports");
  const [card, setCard] = useState(() => toMoneyReportCardState(initialCard));
  const [exporting, setExporting] = useState(false);
  const [pending, startTransition] = useTransition();

  function onPeriodChange(period: ReportPeriod) {
    if (period === card.period || pending) return;
    startTransition(async () => {
      const result = await loadMoneyReportCardAction(card.key, period);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setCard(result.card);
    });
  }

  async function onExport() {
    if (exporting || card.count === 0) return;
    setExporting(true);
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      const { filename, csv } = buildMoneyReportCsv(
        card,
        exportUserSlug,
        garageGstin,
        {
          title: t(`kinds.${card.key}`),
          rangeLine: t("export.rangeMoney"),
          totalLabel: t("export.total"),
          headers: {
            period: t("export.columns.period"),
            reference: t("export.columns.reference"),
            detail: t("export.columns.detail"),
            date: t("export.columns.date"),
            amount: t("export.columns.amount"),
          },
        },
      );
      downloadCsv(filename, csv);
      await new Promise((resolve) => window.setTimeout(resolve, 350));
    } finally {
      setExporting(false);
    }
  }

  return (
    <ReportCardShell
      pending={pending}
      title={t(`kinds.${card.key}`)}
      countLabel={t("cardCount", { count: card.count })}
      hero={
        <span className={ACCENT[card.key]}>
          {formatRupees(card.totalPaise)}
        </span>
      }
      actions={
        <>
          <FormSelect
            value={card.period}
            onValueChange={(value) => onPeriodChange(value as ReportPeriod)}
            disabled={pending}
            className="w-32 sm:w-36"
            triggerClassName="min-h-10 h-10"
            options={REPORT_PERIODS.map((period) => ({
              value: period,
              label: t(`periods.${period}`),
            }))}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-10 h-10 shrink-0 gap-1.5 border-slate-300 bg-white text-[13px] font-semibold"
            onClick={onExport}
            loading={exporting}
            disabled={card.count === 0 || pending}
          >
            <Download className="size-4" aria-hidden />
            {t("exportButton")}
          </Button>
        </>
      }
      chart={
        <ReportChart
          points={card.series}
          valueLabel={t(`kinds.${card.key}`)}
          variant="line"
        />
      }
    />
  );
}

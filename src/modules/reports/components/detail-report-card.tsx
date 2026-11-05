"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { loadDetailReportCardAction } from "@/app/actions/reports";
import { DetailReportSummary } from "@/modules/reports/components/detail-report-summary";
import { ReportChart } from "@/modules/reports/components/report-chart";
import { ReportCardShell } from "@/modules/reports/components/report-card-shell";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/ui/form-select";
import { sanitizeCsvFilename } from "@/lib/csv";
import { formatRupees } from "@/lib/money";
import { buildDetailReportCsv } from "@/modules/reports/detail-export";
import type { DetailReportCardView } from "@/modules/reports/detail-types";
import {
  REPORT_PERIODS,
  type DetailReportKey,
  type ReportPeriod,
} from "@/modules/reports/schema";

type Props = {
  initialCard: DetailReportCardView;
  exportUserSlug: string;
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

const ACCENT: Record<DetailReportKey, string> = {
  parts_stock: "text-slate-900",
  stock_movements: "text-sky-700",
  invoice_tax: "text-amber-700",
  hsn: "text-violet-700",
};

export function DetailReportCard({ initialCard, exportUserSlug }: Props) {
  const t = useTranslations("reports");
  const [card, setCard] = useState(initialCard);
  const [exporting, setExporting] = useState(false);
  const [pending, startTransition] = useTransition();

  function onPeriodChange(period: ReportPeriod) {
    if (period === card.period || pending) return;
    startTransition(async () => {
      const result = await loadDetailReportCardAction(card.key, period);
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
      const { filename, csv } = buildDetailReportCsv(
        card.payload,
        exportUserSlug,
        {
          title: t(`detail.kinds.${card.key}`),
          rangePartsStock: t("detail.range.partsStock"),
          rangeMovements: t("detail.range.movements"),
          rangeInvoices: t("detail.range.invoices"),
          rangeHsn: t("detail.range.hsn"),
          totalLabel: t("export.total"),
          headers: {
            parts_stock: [
              t("detail.columns.itemName"),
              t("detail.columns.sku"),
              t("detail.columns.unit"),
              t("detail.columns.purchaseRate"),
              t("detail.columns.sellingPrice"),
              t("detail.columns.onHand"),
              t("detail.columns.qtyIn"),
              t("detail.columns.qtyOut"),
              t("detail.columns.lowStock"),
              t("detail.columns.hsn"),
              t("detail.columns.gstPercent"),
            ],
            stock_movements: [
              t("detail.columns.date"),
              t("detail.columns.part"),
              t("detail.columns.sku"),
              t("detail.columns.type"),
              t("detail.columns.qtyChange"),
              t("detail.columns.note"),
              t("detail.columns.reference"),
            ],
            invoice_tax: [
              t("detail.columns.invoice"),
              t("detail.columns.date"),
              t("detail.columns.customer"),
              t("detail.columns.taxable"),
              t("detail.columns.cgst"),
              t("detail.columns.sgst"),
              t("detail.columns.igst"),
              t("detail.columns.total"),
              t("detail.columns.split"),
            ],
            hsn: [
              t("detail.columns.hsnOrSac"),
              t("detail.columns.taxable"),
              t("detail.columns.cgst"),
              t("detail.columns.sgst"),
              t("detail.columns.igst"),
              t("detail.columns.total"),
              t("detail.columns.lineCount"),
            ],
          },
          movementTypes: {
            IN: t("detail.movementTypes.IN"),
            OUT: t("detail.movementTypes.OUT"),
            ADJUSTMENT: t("detail.movementTypes.ADJUSTMENT"),
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
      title={t(`detail.kinds.${card.key}`)}
      countLabel={t(`detail.countLabel.${card.key}`, { count: card.count })}
      hero={
        <span className={ACCENT[card.key]}>
          {card.heroKind === "money"
            ? formatRupees(card.heroValue)
            : card.heroValue.toLocaleString("en-IN")}
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
        card.key === "invoice_tax" ? (
          <ReportChart
            points={card.series.map((point) => ({
              ...point,
              label: t(`detail.columns.${point.key}`),
            }))}
            valueLabel={t(`detail.kinds.${card.key}`)}
            valueFormat={card.chartFormat}
            variant="donut"
          />
        ) : (
          <DetailReportSummary card={card} />
        )
      }
    />
  );
}

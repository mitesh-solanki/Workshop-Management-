"use client";

import { useTranslations } from "next-intl";
import { formatRupees } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { DetailReportCardView } from "@/modules/reports/detail-types";

type Metric = {
  key: string;
  label: string;
  value: string;
  accent?: string;
};

type Translate = (key: string) => string;

type Props = {
  card: DetailReportCardView;
  className?: string;
};

function metricsFor(card: DetailReportCardView, t: Translate): Metric[] {
  if (card.payload.key === "parts_stock") {
    const rows = card.payload.rows;
    const qtyOnHand = rows.reduce(
      (sum, row) => sum + Math.max(0, row.quantityOnHand),
      0,
    );
    const qtyIn = rows.reduce((sum, row) => sum + row.qtyIn, 0);
    const qtyOut = rows.reduce((sum, row) => sum + row.qtyOut, 0);
    return [
      {
        key: "parts",
        label: t("detail.summary.partsCount"),
        value: rows.length.toLocaleString("en-IN"),
      },
      {
        key: "value",
        label: t("detail.summary.stockValue"),
        value: formatRupees(card.heroValue),
        accent: "text-slate-900",
      },
      {
        key: "onHand",
        label: t("detail.summary.qtyOnHand"),
        value: qtyOnHand.toLocaleString("en-IN"),
      },
      {
        key: "in",
        label: t("detail.summary.qtyIn"),
        value: qtyIn.toLocaleString("en-IN"),
        accent: "text-emerald-700",
      },
      {
        key: "out",
        label: t("detail.summary.qtyOut"),
        value: qtyOut.toLocaleString("en-IN"),
        accent: "text-sky-700",
      },
    ];
  }

  if (card.payload.key === "stock_movements") {
    const rows = card.payload.rows;
    let qtyIn = 0;
    let qtyOut = 0;
    for (const row of rows) {
      if (row.type === "IN") qtyIn += Math.abs(row.quantityChange);
      else if (row.type === "OUT") qtyOut += Math.abs(row.quantityChange);
    }
    return [
      {
        key: "entries",
        label: t("detail.summary.stockEntries"),
        value: rows.length.toLocaleString("en-IN"),
        accent: "text-sky-700",
      },
      {
        key: "in",
        label: t("detail.summary.qtyIn"),
        value: qtyIn.toLocaleString("en-IN"),
        accent: "text-emerald-700",
      },
      {
        key: "out",
        label: t("detail.summary.qtyOut"),
        value: qtyOut.toLocaleString("en-IN"),
        accent: "text-rose-700",
      },
    ];
  }

  if (card.payload.key === "hsn") {
    const rows = card.payload.rows;
    const taxable = rows.reduce((sum, row) => sum + row.taxablePaise, 0);
    const gst = rows.reduce(
      (sum, row) => sum + row.cgstPaise + row.sgstPaise + row.igstPaise,
      0,
    );
    return [
      {
        key: "codes",
        label: t("detail.summary.hsnCodes"),
        value: rows.length.toLocaleString("en-IN"),
      },
      {
        key: "total",
        label: t("detail.summary.lineTotal"),
        value: formatRupees(card.heroValue),
        accent: "text-violet-700",
      },
      {
        key: "taxable",
        label: t("detail.columns.taxable"),
        value: formatRupees(taxable),
      },
      {
        key: "gst",
        label: t("detail.summary.gstTotal"),
        value: formatRupees(gst),
        accent: "text-amber-700",
      },
    ];
  }

  return [];
}

export function DetailReportSummary({ card, className }: Props) {
  const t = useTranslations("reports");
  const emptyKey =
    card.key === "parts_stock" ||
    card.key === "stock_movements" ||
    card.key === "hsn"
      ? card.key
      : null;

  if (card.count === 0 && emptyKey) {
    return (
      <div
        className={cn(
          "flex min-h-36 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm text-slate-500",
          className,
        )}
      >
        {t(`detail.empty.${emptyKey}`)}
      </div>
    );
  }

  const metrics = metricsFor(card, t as Translate);

  return (
    <div
      className={cn(
        "rounded-lg border border-slate-100 bg-slate-50/70 p-3 sm:p-4",
        className,
      )}
    >
      <div
        className={cn(
          "grid gap-3",
          metrics.length <= 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2",
        )}
      >
        {metrics.map((metric) => (
          <div
            key={metric.key}
            className="rounded-lg border border-slate-200 bg-white px-3 py-3"
          >
            <p className="text-xs font-medium text-slate-500 sm:text-sm">
              {metric.label}
            </p>
            <p
              className={cn(
                "mt-1 text-base font-bold tabular-nums tracking-tight sm:text-lg",
                metric.accent ?? "text-slate-900",
              )}
            >
              {metric.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

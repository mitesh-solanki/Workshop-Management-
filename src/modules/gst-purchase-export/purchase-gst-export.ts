import { CSV_UTF8_BOM, escapeCsvCell } from "@/lib/csv";
import {
  computeLineGstSplit,
  type GstSplitKindValue,
} from "@/lib/gst";
import type { Paise } from "@/lib/money";
import {
  formatReportDateDdMmYyyy,
  paiseToExportNumber,
  todayExportStamp,
} from "@/modules/reports/sleek-export";

export const PURCHASE_GST_EXPORT_TYPES = [
  "PARTS",
  "OUTSIDE_WORK",
  "EXPENSE",
] as const;
export type PurchaseGstExportType = (typeof PURCHASE_GST_EXPORT_TYPES)[number];

export const PURCHASE_GST_EXPORT_HEADERS = [
  "Date",
  "Type",
  "Vendor",
  "GSTIN",
  "Price",
  "CGST",
  "SGST",
  "IGST",
  "Total",
] as const;

export function purchaseGstExportText(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : "—";
}

export type PurchaseGstExportRow = {
  id: string;
  type: PurchaseGstExportType;
  spentAt: string;
  vendorName: string;
  vendorGstin: string | null;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
};

export const PURCHASE_GST_TYPE_CSV_LABEL: Record<PurchaseGstExportType, string> =
  {
    PARTS: "Parts",
    OUTSIDE_WORK: "Outside Work",
    EXPENSE: "Expense",
  };

export function purchaseGstAmounts(input: {
  taxablePaise: number;
  gstRatePercent: number;
  gstSplit: GstSplitKindValue;
}) {
  return computeLineGstSplit(
    {
      quantity: 1,
      unitPricePaise: input.taxablePaise as Paise,
      gstRatePercent: input.gstRatePercent,
    },
    input.gstSplit === "CGST_SGST",
  );
}

export function purchaseGstExportSheetRows(
  rows: readonly PurchaseGstExportRow[],
): string[][] {
  return rows.map((row) => [
    formatReportDateDdMmYyyy(new Date(row.spentAt)),
    PURCHASE_GST_TYPE_CSV_LABEL[row.type],
    purchaseGstExportText(row.vendorName),
    purchaseGstExportText(row.vendorGstin),
    paiseToExportNumber(row.taxablePaise),
    paiseToExportNumber(row.cgstPaise),
    paiseToExportNumber(row.sgstPaise),
    paiseToExportNumber(row.igstPaise),
    paiseToExportNumber(row.totalPaise),
  ]);
}

export function buildPurchaseGstExportCsv(
  rows: readonly PurchaseGstExportRow[],
): string {
  const lines = [
    PURCHASE_GST_EXPORT_HEADERS.map((header) => escapeCsvCell(header)).join(
      ",",
    ),
    ...purchaseGstExportSheetRows(rows).map((row) =>
      row.map((cell) => escapeCsvCell(cell)).join(","),
    ),
  ];
  return `${CSV_UTF8_BOM}${lines.join("\r\n")}`;
}

export function purchaseGstExportFilename(
  yearMonth: string,
  now = new Date(),
): string {
  const stamp = todayExportStamp(now);
  const match = /^(\d{4})-(\d{2})$/.exec(yearMonth.trim());
  const monthLabel = match
    ? new Intl.DateTimeFormat("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })
        .format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)))
        .replace(/\s+/g, "-")
    : "Period";
  return `${monthLabel}_GST_Purchases_${stamp}.csv`;
}

export function filterSelectedPurchaseGstExportRows(
  rows: readonly PurchaseGstExportRow[],
  selectedIds: readonly string[],
): PurchaseGstExportRow[] {
  const selected = new Set(selectedIds);
  return rows.filter((row) => selected.has(row.id));
}

export function purchaseGstRowId(
  type: PurchaseGstExportType,
  id: string,
): string {
  return `${type}:${id}`;
}

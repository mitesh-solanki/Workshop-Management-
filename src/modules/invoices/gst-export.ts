import { CSV_UTF8_BOM, escapeCsvCell } from "@/lib/csv";
import {
  formatReportDateDdMmYyyy,
  paiseToExportNumber,
  todayExportStamp,
} from "@/modules/reports/sleek-export";

export const GST_EXPORT_HEADERS = [
  "Date",
  "Customer",
  "GSTIN",
  "Price",
  "CGST",
  "SGST",
  "IGST",
  "Total",
] as const;

export type GstExportInvoiceRow = {
  id: string;
  invoiceNumber: string;
  finalizedAt: string;
  customerName: string;
  customerGstin: string | null;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
};

export function gstExportSheetRows(
  invoices: readonly GstExportInvoiceRow[],
): string[][] {
  return invoices.map((invoice) => [
    formatReportDateDdMmYyyy(new Date(invoice.finalizedAt)),
    invoice.customerName,
    invoice.customerGstin?.trim() || "",
    paiseToExportNumber(invoice.taxablePaise),
    paiseToExportNumber(invoice.cgstPaise),
    paiseToExportNumber(invoice.sgstPaise),
    paiseToExportNumber(invoice.igstPaise),
    paiseToExportNumber(invoice.totalPaise),
  ]);
}

export function buildGstExportCsv(
  invoices: readonly GstExportInvoiceRow[],
): string {
  const lines = [
    GST_EXPORT_HEADERS.map((header) => escapeCsvCell(header)).join(","),
    ...gstExportSheetRows(invoices).map((row) =>
      row.map((cell) => escapeCsvCell(cell)).join(","),
    ),
  ];
  return `${CSV_UTF8_BOM}${lines.join("\r\n")}`;
}

export function gstExportFilename(yearMonth: string, now = new Date()): string {
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
  return `${monthLabel}_GST_Invoices_${stamp}.csv`;
}

export function filterSelectedGstExportRows(
  invoices: readonly GstExportInvoiceRow[],
  selectedIds: readonly string[],
): GstExportInvoiceRow[] {
  const selected = new Set(selectedIds);
  return invoices.filter((invoice) => selected.has(invoice.id));
}

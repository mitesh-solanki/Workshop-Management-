import {
  buildSleekBillCsv,
  formatReportDateDdMmYyyy,
  paiseToExportNumber,
  todayExportStamp,
} from "@/modules/reports/sleek-export";
import type { DetailReportPayload } from "@/modules/reports/detail-types";
import type { DetailReportKey } from "@/modules/reports/schema";

export const DETAIL_EXPORT_STEM: Record<DetailReportKey, string> = {
  parts_stock: "Inventory__PartsStockExport",
  stock_movements: "Inventory__InOutInventoryExport",
  invoice_tax: "Billing__InvoiceTaxBreakdownExport",
  hsn: "Billing__HsnReportExport",
};

type Labels = {
  title: string;
  rangePartsStock: string;
  rangeMovements: string;
  rangeInvoices: string;
  rangeHsn: string;
  totalLabel: string;
  headers: {
    parts_stock: string[];
    stock_movements: string[];
    invoice_tax: string[];
    hsn: string[];
  };
  movementTypes: Record<"IN" | "OUT" | "ADJUSTMENT", string>;
};

export function buildDetailReportCsv(
  report: DetailReportPayload,
  userLabel: string,
  labels: Labels,
): { filename: string; csv: string } {
  const from = formatReportDateDdMmYyyy(new Date(report.from));
  const to = formatReportDateDdMmYyyy(new Date(report.to));
  const gstin = report.garage.gstin;

  let rangeLine: string;
  let headers: string[];
  let rows: string[][];

  if (report.key === "parts_stock") {
    rangeLine = labels.rangePartsStock
      .replace("{from}", from)
      .replace("{to}", to);
    headers = labels.headers.parts_stock;
    rows = report.rows.map((row) => [
      row.name,
      row.sku,
      row.unit,
      paiseToExportNumber(row.purchasePricePaise),
      paiseToExportNumber(row.sellingPricePaise),
      String(row.quantityOnHand),
      String(row.qtyIn),
      String(row.qtyOut),
      String(row.lowStockLevel),
      row.hsn,
      String(row.gstRatePercent),
    ]);
  } else if (report.key === "stock_movements") {
    rangeLine = labels.rangeMovements
      .replace("{from}", from)
      .replace("{to}", to);
    headers = labels.headers.stock_movements;
    rows = report.rows.map((row) => [
      formatReportDateDdMmYyyy(new Date(row.date)),
      row.partName,
      row.sku,
      labels.movementTypes[row.type],
      String(row.quantityChange),
      row.note ?? "",
      row.reference,
    ]);
  } else if (report.key === "invoice_tax") {
    rangeLine = labels.rangeInvoices
      .replace("{from}", from)
      .replace("{to}", to);
    headers = labels.headers.invoice_tax;
    rows = report.rows.map((row) => [
      row.invoiceNumber,
      formatReportDateDdMmYyyy(new Date(row.date)),
      row.customerName,
      paiseToExportNumber(row.taxablePaise),
      paiseToExportNumber(row.cgstPaise),
      paiseToExportNumber(row.sgstPaise),
      paiseToExportNumber(row.igstPaise),
      paiseToExportNumber(row.totalPaise),
      row.gstSplit,
    ]);
  } else {
    rangeLine = labels.rangeHsn.replace("{from}", from).replace("{to}", to);
    headers = labels.headers.hsn;
    rows = report.rows.map((row) => [
      row.hsnOrSac,
      paiseToExportNumber(row.taxablePaise),
      paiseToExportNumber(row.cgstPaise),
      paiseToExportNumber(row.sgstPaise),
      paiseToExportNumber(row.igstPaise),
      paiseToExportNumber(row.totalPaise),
      String(row.lineCount),
    ]);
  }

  let footerRows: string[][] | undefined;
  if (report.key === "parts_stock") {
    const stockValue = report.rows.reduce(
      (sum, row) =>
        sum + Math.max(0, row.quantityOnHand) * row.sellingPricePaise,
      0,
    );
    footerRows = [
      [
        labels.totalLabel,
        "",
        "",
        "",
        "",
        String(
          report.rows.reduce((sum, row) => sum + row.quantityOnHand, 0),
        ),
        String(report.rows.reduce((sum, row) => sum + row.qtyIn, 0)),
        String(report.rows.reduce((sum, row) => sum + row.qtyOut, 0)),
        "",
        "",
        "",
      ],
      [
        `${labels.totalLabel} (₹)`,
        "",
        "",
        "",
        paiseToExportNumber(stockValue),
        "",
        "",
        "",
        "",
        "",
        "",
      ],
    ];
  } else if (report.key === "invoice_tax" || report.key === "hsn") {
    const taxable = report.rows.reduce((sum, row) => sum + row.taxablePaise, 0);
    const cgst = report.rows.reduce((sum, row) => sum + row.cgstPaise, 0);
    const sgst = report.rows.reduce((sum, row) => sum + row.sgstPaise, 0);
    const igst = report.rows.reduce((sum, row) => sum + row.igstPaise, 0);
    const total = report.rows.reduce((sum, row) => sum + row.totalPaise, 0);
    footerRows =
      report.key === "invoice_tax"
        ? [
            [
              labels.totalLabel,
              "",
              "",
              paiseToExportNumber(taxable),
              paiseToExportNumber(cgst),
              paiseToExportNumber(sgst),
              paiseToExportNumber(igst),
              paiseToExportNumber(total),
              "",
            ],
          ]
        : [
            [
              labels.totalLabel,
              paiseToExportNumber(taxable),
              paiseToExportNumber(cgst),
              paiseToExportNumber(sgst),
              paiseToExportNumber(igst),
              paiseToExportNumber(total),
              String(
                report.rows.reduce((sum, row) => sum + row.lineCount, 0),
              ),
            ],
          ];
  } else {
    footerRows = [[labels.totalLabel, "", "", "", String(report.rows.length), "", ""]];
  }

  const csv = buildSleekBillCsv({
    title: labels.title,
    userLabel,
    gstin,
    rangeLine,
    headers,
    rows,
    footerRows,
  });

  const filename = `${todayExportStamp()}_${DETAIL_EXPORT_STEM[report.key]}_${userLabel}.csv`;
  return { filename, csv };
}

import { CSV_UTF8_BOM, escapeCsvCell } from "@/lib/csv";
import { formatRupees, type Paise } from "@/lib/money";
import type { MonthlySummaryView } from "@/modules/monthly-summary/types";
import { formatYearMonthLabel } from "@/modules/payroll/date";

function money(paise: Paise): string {
  return formatRupees(paise, "en-IN");
}

const CATEGORY_LABEL: Record<string, string> = {
  invoiceCollections: "Invoice Collections",
  partsPurchases: "Parts Purchases",
  vendorBills: "Vendor Bills Paid",
  outsideWork: "Outside Work",
  expenses: "Garage Expenses",
  payroll: "Staff Payroll",
};

export function monthlySummaryCsvFilename(yearMonth: string): string {
  return `monthly-summary-${yearMonth}.csv`;
}

export function buildMonthlySummaryCsv(summary: MonthlySummaryView): string {
  const monthLabel = formatYearMonthLabel(summary.yearMonth, "en-IN");
  const lines: string[] = [
    ["Monthly Summary", monthLabel].map((cell) => escapeCsvCell(cell)).join(","),
    ["Garage", summary.garageName].map((cell) => escapeCsvCell(cell)).join(","),
    "",
    ["KPI", "This Month", "Last Month"]
      .map((cell) => escapeCsvCell(cell))
      .join(","),
    ["Money In", money(summary.kpis.moneyInPaise), money(summary.kpis.lastMonthMoneyInPaise)]
      .map((cell) => escapeCsvCell(cell))
      .join(","),
    ["Money Out", money(summary.kpis.moneyOutPaise), money(summary.kpis.lastMonthMoneyOutPaise)]
      .map((cell) => escapeCsvCell(cell))
      .join(","),
    ["Profit / Loss", money(summary.kpis.profitPaise), money(summary.kpis.lastMonthProfitPaise)]
      .map((cell) => escapeCsvCell(cell))
      .join(","),
    "",
    ["Category", "Type", "Amount"].map((cell) => escapeCsvCell(cell)).join(","),
  ];

  for (const row of summary.breakdown) {
    lines.push(
      [
        CATEGORY_LABEL[row.categoryKey],
        row.side === "in" ? "Incoming" : "Outgoing",
        money(row.amountPaise),
      ]
        .map((cell) => escapeCsvCell(cell))
        .join(","),
    );
  }

  return `${CSV_UTF8_BOM}${lines.join("\r\n")}`;
}

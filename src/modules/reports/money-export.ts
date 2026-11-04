import {
  buildSleekBillCsv,
  formatReportDateDdMmYyyy,
  paiseToExportNumber,
  todayExportStamp,
} from "@/modules/reports/sleek-export";
import type { MoneyReportCardState } from "@/modules/reports/money-card-state";
import type { ReportCardKey } from "@/modules/reports/schema";

export const MONEY_EXPORT_STEM: Record<ReportCardKey, string> = {
  sales: "Billing__SalesExport",
  payments: "Billing__PaymentsReceivedExport",
  outstanding: "Billing__OutstandingExport",
  creditNotes: "Billing__CreditNotesExport",
};

type Labels = {
  title: string;
  rangeLine: string;
  totalLabel: string;
  headers: {
    period: string;
    reference: string;
    detail: string;
    date: string;
    amount: string;
  };
};

export function buildMoneyReportCsv(
  card: MoneyReportCardState,
  userLabel: string,
  gstin: string | null,
  labels: Labels,
): { filename: string; csv: string } {
  const from = formatReportDateDdMmYyyy(new Date(card.from));
  const to = formatReportDateDdMmYyyy(new Date(card.to));
  const rangeLine = labels.rangeLine
    .replace("{from}", from)
    .replace("{to}", to);

  const headers = [
    labels.headers.period,
    labels.headers.reference,
    labels.headers.detail,
    labels.headers.date,
    labels.headers.amount,
  ];

  const useRows = card.key === "outstanding" || card.rows.length > 0;
  const rows = useRows
    ? card.rows.map((row) => [
        `${from} – ${to}`,
        row.label,
        row.secondary ?? "",
        formatReportDateDdMmYyyy(new Date(row.date)),
        paiseToExportNumber(row.amountPaise),
      ])
    : card.series.map((point) => [
        point.label,
        point.label,
        "",
        point.key,
        paiseToExportNumber(point.amountPaise),
      ]);

  const totalPaise = useRows
    ? card.rows.reduce((sum, row) => sum + row.amountPaise, 0)
    : card.series.reduce((sum, point) => sum + point.amountPaise, 0);

  const csv = buildSleekBillCsv({
    title: labels.title,
    userLabel,
    gstin,
    rangeLine,
    headers,
    rows,
    footerRows: [
      ["", "", "", labels.totalLabel, paiseToExportNumber(totalPaise)],
    ],
  });

  return {
    filename: `${todayExportStamp()}_${MONEY_EXPORT_STEM[card.key]}_${userLabel}.csv`,
    csv,
  };
}

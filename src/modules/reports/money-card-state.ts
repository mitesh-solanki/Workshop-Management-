import type { ReportCardKey, ReportPeriod } from "@/modules/reports/schema";

export type MoneyReportSeriesPoint = {
  key: string;
  label: string;
  amountPaise: number;
  href?: string;
};

export type MoneyReportCardState = {
  key: ReportCardKey;
  period: ReportPeriod;
  from: string;
  to: string;
  totalPaise: number;
  count: number;
  series: MoneyReportSeriesPoint[];
  rows: Array<{
    id: string;
    label: string;
    secondary: string | null;
    date: string;
    amountPaise: number;
  }>;
};

export function toMoneyReportCardState(input: {
  key: ReportCardKey;
  period: ReportPeriod;
  from: Date | string;
  to: Date | string;
  totalPaise: number;
  count: number;
  series: MoneyReportSeriesPoint[];
  rows: Array<{
    id: string;
    label: string;
    secondary: string | null;
    date: Date | string;
    amountPaise: number;
  }>;
}): MoneyReportCardState {
  return {
    key: input.key,
    period: input.period,
    from:
      typeof input.from === "string" ? input.from : input.from.toISOString(),
    to: typeof input.to === "string" ? input.to : input.to.toISOString(),
    totalPaise: input.totalPaise,
    count: input.count,
    series: input.series,
    rows: input.rows.map((row) => ({
      id: row.id,
      label: row.label,
      secondary: row.secondary,
      date:
        typeof row.date === "string" ? row.date : row.date.toISOString(),
      amountPaise: row.amountPaise,
    })),
  };
}

export function moneyCardDateLabel(card: MoneyReportCardState): string {
  return `${card.from.slice(0, 10)} – ${card.to.slice(0, 10)}`;
}

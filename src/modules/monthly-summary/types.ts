import type { Paise } from "@/lib/money";

export const CHART_RANGE_OPTIONS = [
  "lastMonth",
  "last3Months",
  "last6Months",
  "lastYear",
] as const;

export type ChartRangeOption = (typeof CHART_RANGE_OPTIONS)[number];

export type PaymentPoint = {
  key: string;
  labelKey: "cash" | "upi" | "card";
  amountPaise: Paise;
  previousAmountPaise: Paise;
};

export type ActivityPoint = {
  key: string;
  labelKey:
    | "customers"
    | "vehicles"
    | "jobCards"
    | "partsIn"
    | "partsUsed"
    | "outsideWork";
  count: number;
  previousCount: number;
};

export type MonthlySummaryView = {
  yearMonth: string;
  isEmpty: boolean;
  garageName: string;
  kpis: {
    moneyInPaise: Paise;
    moneyOutPaise: Paise;
    profitPaise: Paise;
    lastMonthMoneyInPaise: Paise;
    lastMonthMoneyOutPaise: Paise;
    lastMonthProfitPaise: Paise;
  };
  charts: {
    payments: Record<ChartRangeOption, PaymentPoint[]>;
    activity: Record<ChartRangeOption, ActivityPoint[]>;
  };
  breakdown: Array<{
    id: string;
    side: "in" | "out";
    categoryKey:
      | "invoiceCollections"
      | "partsPurchases"
      | "expenses"
      | "outsideWork"
      | "payroll"
      | "vendorBills";
    amountPaise: Paise;
  }>;
};

import "server-only";

import { calendarDateKeyBoundsUtc } from "@/lib/calendar-day";
import { ForbiddenError } from "@/lib/errors";
import { type Paise } from "@/lib/money";
import { requireRole, type RoleSession } from "@/lib/rbac";
import {
  currentYearMonth,
  shiftYearMonth,
} from "@/modules/payroll/date";
import {
  findGarageName,
  loadPeriodTotals,
  type MonthlyPeriodTotals,
} from "@/modules/monthly-summary/repo";
import {
  CHART_RANGE_OPTIONS,
  type ActivityPoint,
  type ChartRangeOption,
  type MonthlySummaryView,
  type PaymentPoint,
} from "@/modules/monthly-summary/types";

const ACCESS_ROLES = ["OWNER", "MANAGER", "ACCOUNTANT"] as const;

export type { MonthlySummaryView, ChartRangeOption, PaymentPoint, ActivityPoint };
export { CHART_RANGE_OPTIONS };

function resolveYearMonth(raw: string | undefined | null): string {
  const value = raw?.trim() ?? "";
  if (/^\d{4}-\d{2}$/.test(value)) return value;
  return currentYearMonth();
}

/** Workshop calendar month as UTC [start, end). */
export function yearMonthBoundsUtc(yearMonth: string): {
  start: Date;
  end: Date;
} {
  const startBounds = calendarDateKeyBoundsUtc(`${yearMonth}-01`);
  if (!startBounds) {
    throw new Error("invalidYearMonth");
  }
  const next = shiftYearMonth(yearMonth, 1);
  const endBounds = calendarDateKeyBoundsUtc(`${next}-01`);
  if (!endBounds) {
    throw new Error("invalidYearMonth");
  }
  return { start: startBounds.start, end: endBounds.start };
}

function rangeBounds(
  yearMonth: string,
  range: ChartRangeOption,
): { start: Date; end: Date; months: number } {
  if (range === "lastMonth") {
    const ym = shiftYearMonth(yearMonth, -1);
    const bounds = yearMonthBoundsUtc(ym);
    return { ...bounds, months: 1 };
  }
  if (range === "lastYear") {
    const ym = shiftYearMonth(yearMonth, -12);
    const bounds = yearMonthBoundsUtc(ym);
    return { ...bounds, months: 1 };
  }
  const months = range === "last3Months" ? 3 : 6;
  const startYm = shiftYearMonth(yearMonth, -months);
  const endYm = yearMonth;
  const start = yearMonthBoundsUtc(startYm).start;
  const end = yearMonthBoundsUtc(endYm).start;
  return { start, end, months };
}

function averagePaise(total: Paise, months: number): Paise {
  if (months <= 1) return total;
  return Math.round(total / months) as Paise;
}

function averageCount(total: number, months: number): number {
  if (months <= 1) return total;
  return Math.round(total / months);
}

function paymentPoints(
  current: MonthlyPeriodTotals,
  previous: MonthlyPeriodTotals,
  months: number,
): PaymentPoint[] {
  return [
    {
      key: "cash",
      labelKey: "cash",
      amountPaise: current.cashPaise,
      previousAmountPaise: averagePaise(previous.cashPaise, months),
    },
    {
      key: "upi",
      labelKey: "upi",
      amountPaise: current.upiPaise,
      previousAmountPaise: averagePaise(previous.upiPaise, months),
    },
    {
      key: "card",
      labelKey: "card",
      amountPaise: current.cardPaise,
      previousAmountPaise: averagePaise(previous.cardPaise, months),
    },
  ];
}

function activityPoints(
  current: MonthlyPeriodTotals,
  previous: MonthlyPeriodTotals,
  months: number,
): ActivityPoint[] {
  return [
    {
      key: "customers",
      labelKey: "customers",
      count: current.customers,
      previousCount: averageCount(previous.customers, months),
    },
    {
      key: "vehicles",
      labelKey: "vehicles",
      count: current.vehicles,
      previousCount: averageCount(previous.vehicles, months),
    },
    {
      key: "jobCards",
      labelKey: "jobCards",
      count: current.jobCards,
      previousCount: averageCount(previous.jobCards, months),
    },
    {
      key: "partsIn",
      labelKey: "partsIn",
      count: current.partsIn,
      previousCount: averageCount(previous.partsIn, months),
    },
    {
      key: "partsUsed",
      labelKey: "partsUsed",
      count: current.partsUsed,
      previousCount: averageCount(previous.partsUsed, months),
    },
    {
      key: "outsideWork",
      labelKey: "outsideWork",
      count: current.outsideWork,
      previousCount: averageCount(previous.outsideWork, months),
    },
  ];
}

function isEmptyPeriod(totals: MonthlyPeriodTotals): boolean {
  return (
    totals.moneyInPaise === 0 &&
    totals.moneyOutPaise === 0 &&
    totals.customers === 0 &&
    totals.vehicles === 0 &&
    totals.jobCards === 0 &&
    totals.partsIn === 0 &&
    totals.partsUsed === 0 &&
    totals.outsideWork === 0
  );
}

export async function getMonthlySummary(
  session: RoleSession,
  yearMonthRaw?: string | null,
): Promise<MonthlySummaryView> {
  requireRole(session, ACCESS_ROLES);
  const yearMonth = resolveYearMonth(yearMonthRaw);
  const garage = await findGarageName(session.garageId);
  if (!garage) {
    throw new ForbiddenError();
  }

  const thisBounds = yearMonthBoundsUtc(yearMonth);
  const lastMonthYm = shiftYearMonth(yearMonth, -1);
  const lastBounds = yearMonthBoundsUtc(lastMonthYm);

  const compareWindows = Object.fromEntries(
    CHART_RANGE_OPTIONS.map((range) => [range, rangeBounds(yearMonth, range)]),
  ) as Record<ChartRangeOption, { start: Date; end: Date; months: number }>;

  const uniqueWindows = new Map<string, { start: Date; end: Date }>();
  function windowKey(start: Date, end: Date) {
    return `${start.toISOString()}|${end.toISOString()}`;
  }
  uniqueWindows.set(windowKey(thisBounds.start, thisBounds.end), thisBounds);
  uniqueWindows.set(windowKey(lastBounds.start, lastBounds.end), lastBounds);
  for (const bounds of Object.values(compareWindows)) {
    uniqueWindows.set(windowKey(bounds.start, bounds.end), {
      start: bounds.start,
      end: bounds.end,
    });
  }

  const loaded = new Map<string, MonthlyPeriodTotals>();
  await Promise.all(
    [...uniqueWindows.entries()].map(async ([key, bounds]) => {
      const totals = await loadPeriodTotals(
        session.garageId,
        bounds.start,
        bounds.end,
      );
      loaded.set(key, totals);
    }),
  );

  function totalsFor(start: Date, end: Date) {
    return loaded.get(windowKey(start, end))!;
  }

  const current = totalsFor(thisBounds.start, thisBounds.end);
  const lastMonth = totalsFor(lastBounds.start, lastBounds.end);

  const payments = {} as MonthlySummaryView["charts"]["payments"];
  const activity = {} as MonthlySummaryView["charts"]["activity"];
  for (const range of CHART_RANGE_OPTIONS) {
    const window = compareWindows[range];
    const previous = totalsFor(window.start, window.end);
    payments[range] = paymentPoints(current, previous, window.months);
    activity[range] = activityPoints(current, previous, window.months);
  }

  const profitPaise = (current.moneyInPaise - current.moneyOutPaise) as Paise;
  const lastProfit = (lastMonth.moneyInPaise - lastMonth.moneyOutPaise) as Paise;

  return {
    yearMonth,
    isEmpty: isEmptyPeriod(current),
    garageName: garage.name,
    kpis: {
      moneyInPaise: current.moneyInPaise,
      moneyOutPaise: current.moneyOutPaise,
      profitPaise,
      lastMonthMoneyInPaise: lastMonth.moneyInPaise,
      lastMonthMoneyOutPaise: lastMonth.moneyOutPaise,
      lastMonthProfitPaise: lastProfit,
    },
    charts: { payments, activity },
    breakdown: (
      [
        {
          id: "invoiceCollections",
          side: "in" as const,
          categoryKey: "invoiceCollections" as const,
          amountPaise: current.invoiceCollectionsPaise,
        },
        {
          id: "vendorBills",
          side: "out" as const,
          categoryKey: "vendorBills" as const,
          amountPaise: current.vendorBillsPaise,
        },
        {
          id: "outsideWork",
          side: "out" as const,
          categoryKey: "outsideWork" as const,
          amountPaise: current.outsideWorkPaise,
        },
        {
          id: "expenses",
          side: "out" as const,
          categoryKey: "expenses" as const,
          amountPaise: current.expensesPaise,
        },
        {
          id: "payroll",
          side: "out" as const,
          categoryKey: "payroll" as const,
          amountPaise: current.payrollPaise,
        },
      ] as MonthlySummaryView["breakdown"]
    ).filter((row) => row.amountPaise > 0),
  };
}

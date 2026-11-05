import { financialYearStart } from "@/lib/financial-year";
import type { ReportPeriod } from "@/modules/reports/schema";

export type ReportBucket = "day" | "week" | "month";

export type ReportRange = {
  from: Date;
  to: Date;
  bucket: ReportBucket;
  period: ReportPeriod;
};

function startOfLocalDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfLocalDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Resolve a preset period into an inclusive date range (local time). */
export function resolveReportPeriod(
  period: ReportPeriod,
  now: Date = new Date(),
): ReportRange {
  const today = startOfLocalDay(now);
  const to = endOfLocalDay(now);

  if (period === "last_30_days") {
    return {
      period,
      from: startOfLocalDay(addDays(today, -29)),
      to,
      bucket: "day",
    };
  }

  if (period === "last_3_months") {
    return {
      period,
      from: startOfLocalDay(addMonths(today, -3)),
      to,
      bucket: "week",
    };
  }

  if (period === "last_6_months") {
    return {
      period,
      from: startOfLocalDay(addMonths(today, -6)),
      to,
      bucket: "month",
    };
  }

  const fyStartYear = financialYearStart(now);
  if (period === "this_year") {
    return {
      period,
      from: new Date(fyStartYear, 3, 1, 0, 0, 0, 0),
      to,
      bucket: "month",
    };
  }

  return {
    period,
    from: new Date(fyStartYear - 1, 3, 1, 0, 0, 0, 0),
    to: new Date(fyStartYear, 2, 31, 23, 59, 59, 999),
    bucket: "month",
  };
}

export function bucketKey(date: Date, bucket: ReportBucket): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  if (bucket === "day") {
    return `${year}-${month}-${day}`;
  }
  if (bucket === "month") {
    return `${year}-${month}`;
  }

  const weekStart = startOfLocalDay(date);
  const weekday = (weekStart.getDay() + 6) % 7;
  weekStart.setDate(weekStart.getDate() - weekday);
  const wYear = weekStart.getFullYear();
  const wMonth = String(weekStart.getMonth() + 1).padStart(2, "0");
  const wDay = String(weekStart.getDate()).padStart(2, "0");
  return `${wYear}-${wMonth}-${wDay}`;
}

/** Build empty series points covering the whole range so charts stay continuous. */
export function buildEmptyBuckets(
  from: Date,
  to: Date,
  bucket: ReportBucket,
): string[] {
  const keys: string[] = [];
  const cursor = startOfLocalDay(from);
  const end = startOfLocalDay(to);

  while (cursor <= end) {
    keys.push(bucketKey(cursor, bucket));
    if (bucket === "day") {
      cursor.setDate(cursor.getDate() + 1);
    } else if (bucket === "week") {
      cursor.setDate(cursor.getDate() + 7);
    } else {
      cursor.setMonth(cursor.getMonth() + 1);
      cursor.setDate(1);
    }
  }

  return [...new Set(keys)];
}

/** Chart / table label: DD-MM-YYYY (day/week) or MM-YYYY (month). */
export function formatBucketLabel(key: string, bucket: ReportBucket): string {
  if (bucket === "month") {
    const [year, month] = key.split("-");
    if (!year || !month) return key;
    return `${month}-${year}`;
  }

  const [year, month, day] = key.split("-");
  if (!year || !month || !day) return key;
  return `${day}-${month}-${year}`;
}

/** Format a Date (UTC date column) as yyyy-mm-dd for form inputs. */
export function toDateInputValue(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayDateInputValue(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Current calendar month as YYYY-MM (local). */
export function currentYearMonth(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Parse YYYY-MM into UTC period start/end (inclusive calendar month). */
export function periodFromYearMonth(yearMonth: string): {
  periodStart: Date;
  periodEnd: Date;
} {
  const match = /^(\d{4})-(\d{2})$/.exec(yearMonth.trim());
  if (!match) {
    throw new Error("invalidYearMonth");
  }
  const y = Number(match[1]);
  const m = Number(match[2]);
  if (m < 1 || m > 12) {
    throw new Error("invalidYearMonth");
  }
  const periodStart = new Date(Date.UTC(y, m - 1, 1));
  const periodEnd = new Date(Date.UTC(y, m, 0));
  return { periodStart, periodEnd };
}

export function formatYearMonthLabel(yearMonth: string, locale: string): string {
  const { periodStart } = periodFromYearMonth(yearMonth);
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(periodStart);
}

export function formatPeriodLabel(
  start: Date | string,
  end: Date | string,
  locale: string,
): string {
  const fmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${fmt.format(new Date(start))} – ${fmt.format(new Date(end))}`;
}

/** Short month + year only, e.g. "Nov 2026". */
export function formatPeriodMonthYear(
  start: Date | string,
  locale: string,
): string {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(start));
}

export function shiftYearMonth(yearMonth: string, deltaMonths: number): string {
  const { periodStart } = periodFromYearMonth(yearMonth);
  const next = new Date(
    Date.UTC(
      periodStart.getUTCFullYear(),
      periodStart.getUTCMonth() + deltaMonths,
      1,
    ),
  );
  const y = next.getUTCFullYear();
  const m = String(next.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

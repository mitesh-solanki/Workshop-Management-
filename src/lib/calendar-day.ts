/** Default workshop calendar — India product; no per-garage timezone yet. */
export const WORKSHOP_TIME_ZONE = "Asia/Kolkata";

/**
 * Inclusive start / exclusive end UTC instants for the calendar day of `now`
 * in `timeZone` (e.g. Asia/Kolkata).
 */
export function calendarDayBoundsUtc(
  now: Date = new Date(),
  timeZone: string = WORKSHOP_TIME_ZONE,
): { start: Date; end: Date } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  if (!year || !month || !day) {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }

  const start = zonedCivilTimeToUtc(year, month, day, 0, 0, 0, timeZone);
  const end = zonedCivilTimeToUtc(year, month, day + 1, 0, 0, 0, timeZone);
  return { start, end };
}

/**
 * From start of today through end of the day `extraDays` ahead (inclusive).
 * `extraDays: 1` → today and tomorrow (exclusive end = start of day after tomorrow).
 */
export function calendarDaysAheadBoundsUtc(
  extraDays: number,
  now: Date = new Date(),
  timeZone: string = WORKSHOP_TIME_ZONE,
): { start: Date; end: Date } {
  const today = calendarDayBoundsUtc(now, timeZone);
  const midTomorrow = new Date(today.start.getTime() + (extraDays + 0.5) * 86_400_000);
  const lastDay = calendarDayBoundsUtc(midTomorrow, timeZone);
  return { start: today.start, end: lastDay.end };
}

/** Single workshop calendar day at `dayOffset` from today (0 = today, 1 = tomorrow). */
export function calendarDayOffsetBoundsUtc(
  dayOffset: number,
  now: Date = new Date(),
  timeZone: string = WORKSHOP_TIME_ZONE,
): { start: Date; end: Date } {
  const today = calendarDayBoundsUtc(now, timeZone);
  const mid = new Date(today.start.getTime() + (dayOffset + 0.5) * 86_400_000);
  return calendarDayBoundsUtc(mid, timeZone);
}

/** Parse `YYYY-MM-DD` as a workshop calendar day → UTC [start, end). */
export function calendarDateKeyBoundsUtc(
  dateKey: string,
  timeZone: string = WORKSHOP_TIME_ZONE,
): { start: Date; end: Date } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey.trim());
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || !month || !day) {
    return null;
  }
  const start = zonedCivilTimeToUtc(year, month, day, 0, 0, 0, timeZone);
  const end = zonedCivilTimeToUtc(year, month, day + 1, 0, 0, 0, timeZone);
  return { start, end };
}

/** Convert a civil date/time in `timeZone` to a UTC Date (handles day overflow). */
function zonedCivilTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): Date {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const asInZone = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(utcGuess);

  const zYear = Number(asInZone.find((p) => p.type === "year")?.value);
  const zMonth = Number(asInZone.find((p) => p.type === "month")?.value);
  const zDay = Number(asInZone.find((p) => p.type === "day")?.value);
  const zHour = Number(asInZone.find((p) => p.type === "hour")?.value);
  const zMinute = Number(asInZone.find((p) => p.type === "minute")?.value);
  const zSecond = Number(asInZone.find((p) => p.type === "second")?.value);

  const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const actualAsUtc = Date.UTC(zYear, zMonth - 1, zDay, zHour, zMinute, zSecond);
  return new Date(utcGuess.getTime() + (desiredAsUtc - actualAsUtc));
}

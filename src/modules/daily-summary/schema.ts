import { z } from "zod";
import { calendarDateKeyBoundsUtc } from "@/lib/calendar-day";

function isRealCalendarDateKey(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day &&
    calendarDateKeyBoundsUtc(value) != null
  );
}

export const dailySummaryDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "validation.invalidDate" })
  .refine(isRealCalendarDateKey, {
    error: "validation.invalidDate",
  });

export type DailySummaryDateInput = z.infer<typeof dailySummaryDateSchema>;

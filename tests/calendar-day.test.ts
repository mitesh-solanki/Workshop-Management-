import { describe, expect, it } from "vitest";
import { calendarDayBoundsUtc } from "@/lib/calendar-day";

describe("calendarDayBoundsUtc", () => {
  it("returns Asia/Kolkata day bounds that contain a mid-day IST instant", () => {
    // 2026-10-28 15:30 IST = 2026-10-28 10:00 UTC
    const now = new Date("2026-10-28T10:00:00.000Z");
    const { start, end } = calendarDayBoundsUtc(now, "Asia/Kolkata");

    expect(start.toISOString()).toBe("2026-10-27T18:30:00.000Z");
    expect(end.toISOString()).toBe("2026-10-28T18:30:00.000Z");
    expect(start.getTime()).toBeLessThan(now.getTime());
    expect(end.getTime()).toBeGreaterThan(now.getTime());
  });

  it("treats early-morning IST due times as the same calendar day", () => {
    // Due 2026-10-27T21:58Z = 2026-10-28 03:28 IST
    const due = new Date("2026-10-27T21:58:00.000Z");
    const now = new Date("2026-10-28T10:00:00.000Z");
    const { start, end } = calendarDayBoundsUtc(now, "Asia/Kolkata");

    expect(due.getTime()).toBeGreaterThanOrEqual(start.getTime());
    expect(due.getTime()).toBeLessThan(end.getTime());
  });
});

import { describe, expect, it } from "vitest";
import {
  bucketKey,
  buildEmptyBuckets,
  resolveReportPeriod,
} from "@/modules/reports/period";

describe("resolveReportPeriod", () => {
  it("uses a 30-day window ending today", () => {
    const now = new Date(2026, 10, 4, 15, 30, 0);
    const range = resolveReportPeriod("last_30_days", now);
    expect(range.from.getFullYear()).toBe(2026);
    expect(range.from.getMonth()).toBe(9);
    expect(range.from.getDate()).toBe(6);
    expect(range.bucket).toBe("day");
  });

  it("uses Indian financial year for this_year and last_year", () => {
    const now = new Date(2026, 10, 4);
    const thisYear = resolveReportPeriod("this_year", now);
    expect(thisYear.from).toEqual(new Date(2026, 3, 1, 0, 0, 0, 0));
    expect(thisYear.bucket).toBe("month");

    const lastYear = resolveReportPeriod("last_year", now);
    expect(lastYear.from).toEqual(new Date(2025, 3, 1, 0, 0, 0, 0));
    expect(lastYear.to.getFullYear()).toBe(2026);
    expect(lastYear.to.getMonth()).toBe(2);
  });
});

describe("bucket helpers", () => {
  it("builds continuous month keys", () => {
    const keys = buildEmptyBuckets(
      new Date(2026, 3, 1),
      new Date(2026, 5, 15),
      "month",
    );
    expect(keys).toEqual(["2026-04", "2026-05", "2026-06"]);
  });

  it("buckets weeks to Monday start", () => {
    const wednesday = new Date(2026, 10, 4);
    expect(bucketKey(wednesday, "week")).toBe("2026-11-02");
  });
});

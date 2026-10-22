import { describe, expect, it } from "vitest";
import { getDateStatus } from "@/lib/date-status";

describe("getDateStatus", () => {
  const now = new Date(2026, 9, 22); // 22 Oct 2026

  it("returns unset for null", () => {
    expect(getDateStatus(null, now)).toBe("unset");
  });

  it("returns expired for past dates", () => {
    expect(getDateStatus(new Date(2026, 9, 21), now)).toBe("expired");
  });

  it("returns soon within 30 days", () => {
    expect(getDateStatus(new Date(2026, 10, 10), now)).toBe("soon");
  });

  it("returns ok beyond 30 days", () => {
    expect(getDateStatus(new Date(2027, 0, 1), now)).toBe("ok");
  });

  it("treats today as soon (expires today)", () => {
    expect(getDateStatus(new Date(2026, 9, 22), now)).toBe("soon");
  });
});

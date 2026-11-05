import { describe, expect, it } from "vitest";
import {
  computePayrollNetPaise,
  defaultMonthPeriod,
  draftBasicPaise,
  inclusiveDayCount,
  planAdvanceDeductions,
  planAdvanceRestores,
} from "@/modules/payroll/calc";

describe("payroll calc", () => {
  it("plans advance restores into remaining room", () => {
    const plan = planAdvanceRestores(
      [
        { id: "a2", amountPaise: 300_000, remainingPaise: 100_000 },
        { id: "a1", amountPaise: 500_000, remainingPaise: 500_000 },
      ],
      250_000,
    );
    expect(plan).toEqual([{ id: "a2", restorePaise: 200_000 }]);
  });

  it("counts inclusive calendar days", () => {
    expect(
      inclusiveDayCount(
        new Date(Date.UTC(2026, 10, 1)),
        new Date(Date.UTC(2026, 10, 30)),
      ),
    ).toBe(30);
  });

  it("drafts full basic", () => {
    expect(
      draftBasicPaise({
        basicSalaryPaise: 2_000_000,
        payMode: "FULL_BASIC",
        periodStart: new Date(Date.UTC(2026, 10, 1)),
        periodEnd: new Date(Date.UTC(2026, 10, 30)),
      }),
    ).toBe(2_000_000);
  });

  it("computes net with advance and adjustments", () => {
    expect(
      computePayrollNetPaise({
        basicPaise: 2_000_000,
        bonusPaise: 100_000,
        commissionPaise: 200_000,
        advanceDeductedPaise: 500_000,
        adjustmentPaise: -20_000,
      }),
    ).toBe(1_780_000);
  });

  it("plans FIFO advance deductions", () => {
    expect(
      planAdvanceDeductions(
        [
          { id: "a1", remainingPaise: 300_000 },
          { id: "a2", remainingPaise: 400_000 },
        ],
        500_000,
      ),
    ).toEqual([
      { id: "a1", deductPaise: 300_000 },
      { id: "a2", deductPaise: 200_000 },
    ]);
  });

  it("defaults period to current calendar month", () => {
    const { periodStart, periodEnd } = defaultMonthPeriod(
      new Date(2026, 10, 15),
    );
    expect(periodStart.toISOString().slice(0, 10)).toBe("2026-11-01");
    expect(periodEnd.toISOString().slice(0, 10)).toBe("2026-11-30");
  });
});

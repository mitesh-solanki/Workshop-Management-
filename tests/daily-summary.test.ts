import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError } from "@/lib/errors";
import type { RoleSession } from "@/lib/rbac";
import { dailySummaryDateSchema } from "@/modules/daily-summary/schema";

vi.mock("@/lib/audit", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/modules/daily-summary/repo", () => ({
  findGarageNameForSummary: vi.fn(),
  listJobCardsCreatedOnDay: vi.fn(),
  listInspectionsCreatedOnDay: vi.fn(),
  countJobsCompletedOnDay: vi.fn(),
  listInvoicesFinalizedOnDay: vi.fn(),
  listPaymentsReceivedOnDay: vi.fn(),
  listExpensesOnDay: vi.fn(),
  countOpenJobsNow: vi.fn(),
  listOpenDuesInvoices: vi.fn(),
}));

import { writeAuditLog } from "@/lib/audit";
import {
  countJobsCompletedOnDay,
  countOpenJobsNow,
  findGarageNameForSummary,
  listExpensesOnDay,
  listInspectionsCreatedOnDay,
  listInvoicesFinalizedOnDay,
  listJobCardsCreatedOnDay,
  listOpenDuesInvoices,
  listPaymentsReceivedOnDay,
} from "@/modules/daily-summary/repo";
import {
  downloadDailySummaryPdf,
  getDailySummary,
  paymentMethodBreakdown,
} from "@/modules/daily-summary/service";

vi.mock("@/modules/daily-summary/pdf", () => ({
  buildDailySummaryPdfBuffer: vi.fn().mockResolvedValue(Buffer.from("%PDF")),
}));

const garageA = "garage-a";

const ownerA: RoleSession = {
  userId: "user-a",
  garageId: garageA,
  role: "OWNER",
};

const techA: RoleSession = {
  userId: "tech-a",
  garageId: garageA,
  role: "TECHNICIAN",
};

describe("dailySummaryDateSchema", () => {
  it("accepts a calendar date key", () => {
    expect(dailySummaryDateSchema.parse("2026-11-05")).toBe("2026-11-05");
  });

  it("rejects invalid dates", () => {
    expect(dailySummaryDateSchema.safeParse("2026-13-01").success).toBe(false);
    expect(dailySummaryDateSchema.safeParse("05-11-2026").success).toBe(false);
  });
});

describe("paymentMethodBreakdown", () => {
  it("uses explicit cash/upi/card split when present", () => {
    expect(
      paymentMethodBreakdown({
        method: "MIXED",
        amountPaise: 10000,
        cashPaise: 4000,
        upiPaise: 6000,
        cardPaise: 0,
      }),
    ).toEqual({ cash: 4000, upi: 6000, card: 0 });
  });

  it("falls back to method when split is zero", () => {
    expect(
      paymentMethodBreakdown({
        method: "UPI",
        amountPaise: 5000,
        cashPaise: 0,
        upiPaise: 0,
        cardPaise: 0,
      }),
    ).toEqual({ cash: 0, upi: 5000, card: 0 });
    expect(
      paymentMethodBreakdown({
        method: "CARD",
        amountPaise: 2500,
        cashPaise: 0,
        upiPaise: 0,
        cardPaise: 0,
      }),
    ).toEqual({ cash: 0, upi: 0, card: 2500 });
    expect(
      paymentMethodBreakdown({
        method: "CASH",
        amountPaise: 1000,
        cashPaise: 0,
        upiPaise: 0,
        cardPaise: 0,
      }),
    ).toEqual({ cash: 1000, upi: 0, card: 0 });
  });
});

describe("getDailySummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findGarageNameForSummary).mockResolvedValue({
      id: garageA,
      name: "Test Garage",
    });
    vi.mocked(listJobCardsCreatedOnDay).mockResolvedValue([]);
    vi.mocked(listInspectionsCreatedOnDay).mockResolvedValue([]);
    vi.mocked(countJobsCompletedOnDay).mockResolvedValue(0);
    vi.mocked(listInvoicesFinalizedOnDay).mockResolvedValue([]);
    vi.mocked(listPaymentsReceivedOnDay).mockResolvedValue([]);
    vi.mocked(listExpensesOnDay).mockResolvedValue([]);
    vi.mocked(countOpenJobsNow).mockResolvedValue(0);
    vi.mocked(listOpenDuesInvoices).mockResolvedValue([]);
  });

  it("blocks technicians", async () => {
    await expect(getDailySummary(techA, "2026-11-05")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("aggregates payments and paid expenses for the day", async () => {
    vi.mocked(listPaymentsReceivedOnDay).mockResolvedValue([
      {
        id: "p1",
        receivedAt: new Date("2026-11-05T04:00:00.000Z"),
        method: "CASH",
        amountPaise: 10000,
        cashPaise: 10000,
        upiPaise: 0,
        cardPaise: 0,
        isRefund: false,
        invoice: {
          id: "inv1",
          invoiceNumber: "INV-1",
          serviceOrderId: "so-1",
          customer: { name: "Asha" },
        },
      },
      {
        id: "p2",
        receivedAt: new Date("2026-11-05T05:00:00.000Z"),
        method: "UPI",
        amountPaise: 2000,
        cashPaise: 0,
        upiPaise: 0,
        cardPaise: 0,
        isRefund: true,
        invoice: {
          id: "inv1",
          invoiceNumber: "INV-1",
          serviceOrderId: "so-1",
          customer: { name: "Asha" },
        },
      },
    ] as never);
    vi.mocked(listExpensesOnDay).mockResolvedValue([
      {
        id: "e1",
        spentAt: new Date("2026-11-05T06:00:00.000Z"),
        category: "Tea",
        status: "PAID",
        method: "CASH",
        amountPaise: 500,
        note: null,
      },
      {
        id: "e2",
        spentAt: new Date("2026-11-05T07:00:00.000Z"),
        category: "Pending bill",
        status: "UNPAID",
        method: null,
        amountPaise: 900,
        note: null,
      },
    ] as never);
    vi.mocked(listOpenDuesInvoices).mockResolvedValue([
      {
        id: "d1",
        invoiceNumber: "INV-2",
        serviceOrderId: "so-2",
        customerName: "Ravi",
        totalPaise: 5000,
        amountPaidPaise: 1500,
        pendingPaise: 3500,
      },
    ]);

    const summary = await getDailySummary(ownerA, "2026-11-05");
    expect(summary.dateKey).toBe("2026-11-05");
    expect(summary.kpis.collectedPaise).toBe(10000);
    expect(summary.kpis.refundedPaise).toBe(2000);
    expect(summary.kpis.cashCollectedPaise).toBe(10000);
    expect(summary.kpis.expensePaise).toBe(500);
    expect(summary.kpis.openDuesPaise).toBe(3500);
    expect(summary.kpis.openDuesCount).toBe(1);
    expect(listJobCardsCreatedOnDay).toHaveBeenCalledWith(
      garageA,
      expect.any(Date),
      expect.any(Date),
    );
  });
});

describe("downloadDailySummaryPdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findGarageNameForSummary).mockResolvedValue({
      id: garageA,
      name: "Test Garage",
    });
    vi.mocked(listJobCardsCreatedOnDay).mockResolvedValue([]);
    vi.mocked(listInspectionsCreatedOnDay).mockResolvedValue([]);
    vi.mocked(countJobsCompletedOnDay).mockResolvedValue(0);
    vi.mocked(listInvoicesFinalizedOnDay).mockResolvedValue([]);
    vi.mocked(listPaymentsReceivedOnDay).mockResolvedValue([]);
    vi.mocked(listExpensesOnDay).mockResolvedValue([]);
    vi.mocked(countOpenJobsNow).mockResolvedValue(0);
    vi.mocked(listOpenDuesInvoices).mockResolvedValue([]);
  });

  it("writes an audit row on download", async () => {
    const result = await downloadDailySummaryPdf(ownerA, "2026-11-05");
    expect(result.dateKey).toBe("2026-11-05");
    expect(result.buffer.toString()).toContain("%PDF");
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        garageId: garageA,
        action: "daily_summary.downloaded",
        entity: "DailySummary",
        entityId: "2026-11-05",
      }),
    );
  });
});

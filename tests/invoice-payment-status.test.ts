import { describe, expect, it } from "vitest";
import {
  invoiceDueDate,
  invoicePaymentStatus,
} from "@/modules/invoices/payment-status";

const finalizedAt = new Date("2026-11-01T10:00:00.000Z");

describe("invoiceDueDate", () => {
  it("returns null for drafts", () => {
    expect(invoiceDueDate(null)).toBeNull();
  });

  it("is finalize date plus 7 days", () => {
    expect(invoiceDueDate(finalizedAt)?.toISOString()).toBe(
      "2026-11-08T10:00:00.000Z",
    );
  });
});

describe("invoicePaymentStatus", () => {
  it("returns DRAFT for draft invoices", () => {
    expect(
      invoicePaymentStatus({
        status: "DRAFT",
        pendingBalancePaise: 10000,
        amountPaidPaise: 0,
        finalizedAt: null,
      }),
    ).toBe("DRAFT");
  });

  it("returns PAID when nothing is pending", () => {
    expect(
      invoicePaymentStatus({
        status: "FINALIZED",
        pendingBalancePaise: 0,
        amountPaidPaise: 50000,
        finalizedAt,
        now: new Date("2026-11-20T10:00:00.000Z"),
      }),
    ).toBe("PAID");
  });

  it("returns DUE when unpaid and within 7 days", () => {
    expect(
      invoicePaymentStatus({
        status: "FINALIZED",
        pendingBalancePaise: 50000,
        amountPaidPaise: 0,
        finalizedAt,
        now: new Date("2026-11-05T10:00:00.000Z"),
      }),
    ).toBe("DUE");
  });

  it("returns PARTIAL when some paid and still due within 7 days", () => {
    expect(
      invoicePaymentStatus({
        status: "FINALIZED",
        pendingBalancePaise: 20000,
        amountPaidPaise: 30000,
        finalizedAt,
        now: new Date("2026-11-05T10:00:00.000Z"),
      }),
    ).toBe("PARTIAL");
  });

  it("returns OVERDUE after 7 days even if partially paid", () => {
    expect(
      invoicePaymentStatus({
        status: "FINALIZED",
        pendingBalancePaise: 20000,
        amountPaidPaise: 30000,
        finalizedAt,
        now: new Date("2026-11-09T10:00:00.000Z"),
      }),
    ).toBe("OVERDUE");
  });

  it("returns OVERDUE after 7 days when unpaid", () => {
    expect(
      invoicePaymentStatus({
        status: "FINALIZED",
        pendingBalancePaise: 50000,
        amountPaidPaise: 0,
        finalizedAt,
        now: new Date("2026-11-09T10:00:00.000Z"),
      }),
    ).toBe("OVERDUE");
  });
});

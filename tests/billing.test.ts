import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError, NotFoundError } from "@/lib/errors";
import type { RoleSession } from "@/lib/rbac";
import {
  formatCreditNoteNumber,
  formatInvoiceNumber,
  financialYearStart,
  formatFinancialYearLabel,
  garageInvoiceCode,
} from "@/lib/financial-year";
import {
  computeLineGst,
  computeLineGstSplit,
  isSameStateSupply,
  splitGstComponents,
  sumLineGstSplit,
} from "@/lib/gst";
import {
  pendingBalancePaise,
  refundDuePaise,
} from "@/modules/billing/balance";
import { getInvoicePdfLabels } from "@/modules/billing/pdf-labels";
import {
  normalizePaymentBreakdown,
  recordPaymentSchema,
} from "@/modules/billing/schema";

vi.mock("@/modules/billing/repo", () => ({
  findInvoiceById: vi.fn(),
  listInvoicesForOrder: vi.fn(),
  findGarageBillingProfile: vi.fn(),
  createDraftInvoice: vi.fn(),
  createAndFinalizeInvoice: vi.fn(),
  finalizeInvoiceInTransaction: vi.fn(),
  recordPaymentRow: vi.fn(),
  recordRefundRow: vi.fn(),
  createCreditNoteRow: vi.fn(),
}));

vi.mock("@/modules/estimates/repo", () => ({
  findCurrentEstimate: vi.fn(),
}));

vi.mock("@/modules/service-orders/repo", () => ({
  findServiceOrderById: vi.fn(),
}));

import {
  findInvoiceById,
  recordPaymentRow,
  recordRefundRow,
} from "@/modules/billing/repo";
import {
  assertInvoiceEditable,
  finalizeInvoice,
  recordInvoicePayment,
  recordInvoiceRefund,
} from "@/modules/billing/service";
import { createVehicleSchema } from "@/modules/vehicles/schema";

const owner: RoleSession = {
  userId: "owner-1",
  garageId: "garage-1",
  role: "OWNER",
};

describe("financial year", () => {
  it("starts in April", () => {
    expect(financialYearStart(new Date(2025, 3, 1))).toBe(2025); // 1 Apr
    expect(financialYearStart(new Date(2025, 2, 31))).toBe(2024); // 31 Mar
    expect(financialYearStart(new Date(2026, 0, 15))).toBe(2025); // 15 Jan
  });

  it("formats labels and invoice numbers with garage code", () => {
    expect(formatFinancialYearLabel(2025)).toBe("2025-26");
    expect(garageInvoiceCode("Prime Motors")).toBe("PM");
    expect(garageInvoiceCode("Maruti")).toBe("MAR");
    expect(garageInvoiceCode("Billing test garage")).toBe("BTG");
    expect(garageInvoiceCode("Shree Auto Care Centre")).toBe("SACC");
    expect(garageInvoiceCode("")).toBe("XX");
    expect(formatInvoiceNumber(2025, 1, "PM")).toBe("INV-PM/2025-26/0001");
    expect(formatInvoiceNumber(2025, 42, "PM")).toBe("INV-PM/2025-26/0042");
    expect(formatCreditNoteNumber(2025, 3, "PM")).toBe("CN-PM/2025-26/0003");
  });
});

describe("GST split CGST/SGST vs IGST", () => {
  it("splits same-state GST into CGST and SGST that sum to the line GST", () => {
    const line = computeLineGst({
      quantity: 1,
      unitPricePaise: 10_000,
      gstRatePercent: 18,
    });
    expect(line.gstPaise).toBe(1_800);
    const split = splitGstComponents(line.gstPaise, true);
    expect(split.kind).toBe("CGST_SGST");
    expect(split.cgstPaise + split.sgstPaise).toBe(1_800);
    expect(split.igstPaise).toBe(0);
  });

  it("puts odd paise on SGST so components stay integers", () => {
    // taxable 999 → GST 180 (half-up); 180/2 → 90 + 90
    const even = splitGstComponents(180, true);
    expect(even).toEqual({
      kind: "CGST_SGST",
      cgstPaise: 90,
      sgstPaise: 90,
      igstPaise: 0,
    });
    // odd GST 181 → 90 + 91
    const odd = splitGstComponents(181, true);
    expect(odd.cgstPaise).toBe(90);
    expect(odd.sgstPaise).toBe(91);
    expect(odd.cgstPaise + odd.sgstPaise).toBe(181);
  });

  it("uses IGST for other-state supply", () => {
    const split = computeLineGstSplit(
      { quantity: 2, unitPricePaise: 50_000, gstRatePercent: 18 },
      false,
    );
    expect(split.kind).toBe("IGST");
    expect(split.taxablePaise).toBe(100_000);
    expect(split.gstPaise).toBe(18_000);
    expect(split.igstPaise).toBe(18_000);
    expect(split.cgstPaise).toBe(0);
    expect(split.sgstPaise).toBe(0);
    expect(split.totalPaise).toBe(118_000);
  });

  it("sums per-line rounded GST then components", () => {
    const lines = [
      { quantity: 1, unitPricePaise: 999, gstRatePercent: 18 },
      { quantity: 1, unitPricePaise: 1_001, gstRatePercent: 18 },
    ];
    // 999*18%=179.82→180; 1001*18%=180.18→180
    const same = sumLineGstSplit(lines, true);
    expect(same.taxablePaise).toBe(2_000);
    expect(same.gstPaise).toBe(360);
    expect(same.cgstPaise + same.sgstPaise).toBe(360);
    expect(same.totalPaise).toBe(2_360);
    expect(same.kind).toBe("CGST_SGST");

    const inter = sumLineGstSplit(lines, false);
    expect(inter.igstPaise).toBe(360);
    expect(inter.cgstPaise).toBe(0);
    expect(inter.kind).toBe("IGST");
  });

  it("detects same-state place of supply", () => {
    expect(isSameStateSupply("24", "24")).toBe(true);
    expect(isSameStateSupply("24", "27")).toBe(false);
  });
});

describe("pending balance", () => {
  it("subtracts payments and credit notes", () => {
    expect(
      pendingBalancePaise({
        totalPaise: 118_000,
        amountPaidPaise: 50_000,
        creditNotesTotalPaise: 18_000,
      }),
    ).toBe(50_000);
  });

  it("never goes negative", () => {
    expect(
      pendingBalancePaise({
        totalPaise: 10_000,
        amountPaidPaise: 8_000,
        creditNotesTotalPaise: 5_000,
      }),
    ).toBe(0);
  });

  it("computes refund due when payments exceed net bill after credit notes", () => {
    expect(
      refundDuePaise({
        totalPaise: 118_000,
        amountPaidPaise: 118_000,
        creditNotesTotalPaise: 20_000,
      }),
    ).toBe(20_000);
    expect(
      refundDuePaise({
        totalPaise: 118_000,
        amountPaidPaise: 50_000,
        creditNotesTotalPaise: 0,
      }),
    ).toBe(0);
  });
});

describe("vehicle state defaults for place of supply", () => {
  it("defaults missing vehicle state to Gujarat (24)", () => {
    const parsed = createVehicleSchema.parse({
      customerId: "cust-1",
      registrationNumber: "GJ01AB1234",
      make: "Maruti",
      model: "Swift",
      year: null,
      odometer: null,
      insuranceExpiry: null,
      pucExpiry: null,
      fitnessExpiry: null,
    });
    expect(parsed.stateCode).toBe("24");
  });

  it("keeps an out-of-state vehicle code for IGST place of supply", () => {
    const parsed = createVehicleSchema.parse({
      customerId: "cust-1",
      registrationNumber: "MH12XY9999",
      make: "Honda",
      model: "City",
      stateCode: "27",
      year: null,
      odometer: null,
      insuranceExpiry: null,
      pucExpiry: null,
      fitnessExpiry: null,
    });
    expect(parsed.stateCode).toBe("27");
    expect(isSameStateSupply("24", parsed.stateCode)).toBe(false);
  });
});

describe("payment breakdown", () => {
  it("fills single-method amounts when breakdown omitted", () => {
    expect(
      normalizePaymentBreakdown({
        method: "UPI",
        amountPaise: 5_000,
      }),
    ).toEqual({ cashPaise: 0, upiPaise: 5_000, cardPaise: 0 });
  });

  it("keeps mixed breakdown", () => {
    expect(
      normalizePaymentBreakdown({
        method: "MIXED",
        amountPaise: 10_000,
        cashPaise: 4_000,
        upiPaise: 6_000,
        cardPaise: 0,
      }),
    ).toEqual({ cashPaise: 4_000, upiPaise: 6_000, cardPaise: 0 });
  });

  it("rejects mixed payments that use only one channel or do not sum", () => {
    expect(
      recordPaymentSchema.safeParse({
        invoiceId: "inv-1",
        method: "MIXED",
        amountPaise: 100,
        cashPaise: 100,
        upiPaise: 0,
        cardPaise: 0,
      }).success,
    ).toBe(false);
    expect(
      recordPaymentSchema.safeParse({
        invoiceId: "inv-1",
        method: "MIXED",
        amountPaise: 100,
        cashPaise: 30,
        upiPaise: 30,
        cardPaise: 30,
      }).success,
    ).toBe(false);
    expect(
      recordPaymentSchema.safeParse({
        invoiceId: "inv-1",
        method: "MIXED",
        amountPaise: 100,
        cashPaise: 40,
        upiPaise: 60,
        cardPaise: 0,
      }).success,
    ).toBe(true);
  });
});

describe("invoice immutability guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("assertInvoiceEditable rejects finalized invoices", async () => {
    vi.mocked(findInvoiceById).mockResolvedValue({
      id: "inv-1",
      status: "FINALIZED",
      totalPaise: 100,
      amountPaidPaise: 0,
      creditNotes: [],
    } as never);

    await expect(assertInvoiceEditable(owner, "inv-1")).rejects.toMatchObject({
      code: "billing.invoice_immutable",
    } satisfies Partial<AppError>);
  });

  it("finalizeInvoice maps immutable draft guard to already-finalized", async () => {
    vi.mocked(findInvoiceById).mockResolvedValue({
      id: "inv-1",
      status: "FINALIZED",
      totalPaise: 100,
      amountPaidPaise: 0,
      creditNotes: [],
    } as never);

    await expect(
      finalizeInvoice(owner, { invoiceId: "inv-1" }),
    ).rejects.toMatchObject({
      code: "billing.invoice_already_finalized",
    } satisfies Partial<AppError>);
  });
});

describe("recordInvoicePayment service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records a partial payment and returns pending balance", async () => {
    vi.mocked(recordPaymentRow).mockResolvedValue({
      payment: {
        id: "pay-1",
        method: "CASH",
        amountPaise: 25_000,
      },
      invoice: {
        id: "inv-1",
        status: "FINALIZED",
        totalPaise: 118_000,
        amountPaidPaise: 25_000,
        creditNotes: [],
        lines: [],
        payments: [],
      },
    } as never);

    const result = await recordInvoicePayment(owner, {
      invoiceId: "inv-1",
      method: "CASH",
      amountPaise: 250,
    });

    expect(recordPaymentRow).toHaveBeenCalledWith(
      "garage-1",
      expect.objectContaining({
        invoiceId: "inv-1",
        method: "CASH",
        amountPaise: 25_000,
        cashPaise: 25_000,
        upiPaise: 0,
        cardPaise: 0,
        actorId: "owner-1",
      }),
    );
    expect(result.invoice.amountPaidPaise).toBe(25_000);
    expect(result.invoice.pendingBalancePaise).toBe(93_000);
  });

  it("refuses payment when repo reports overpay", async () => {
    vi.mocked(recordPaymentRow).mockResolvedValue({
      error: "overpay",
      pending: 5_000,
    });

    await expect(
      recordInvoicePayment(owner, {
        invoiceId: "inv-1",
        method: "UPI",
        amountPaise: 100,
      }),
    ).rejects.toMatchObject({
      code: "billing.payment_exceeds_balance",
    } satisfies Partial<AppError>);
  });

  it("refuses payment on a missing invoice", async () => {
    vi.mocked(recordPaymentRow).mockResolvedValue(null);

    await expect(
      recordInvoicePayment(owner, {
        invoiceId: "missing",
        method: "CARD",
        amountPaise: 10,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("records a refund disbursement against refund due", async () => {
    vi.mocked(recordRefundRow).mockResolvedValue({
      payment: {
        id: "pay-refund",
        method: "CASH",
        amountPaise: 20_000,
        isRefund: true,
      },
      invoice: {
        id: "inv-1",
        status: "FINALIZED",
        totalPaise: 118_000,
        amountPaidPaise: 98_000,
        creditNotes: [{ totalPaise: 20_000 }],
        lines: [],
        payments: [],
      },
    } as never);

    const result = await recordInvoiceRefund(owner, {
      invoiceId: "inv-1",
      method: "CASH",
      amountPaise: 200,
    });

    expect(recordRefundRow).toHaveBeenCalledWith(
      "garage-1",
      expect.objectContaining({
        invoiceId: "inv-1",
        amountPaise: 20_000,
        cashPaise: 20_000,
        actorId: "owner-1",
      }),
    );
    expect(result.invoice.refundDuePaise).toBe(0);
    expect(result.invoice.pendingBalancePaise).toBe(0);
  });
});

describe("invoice PDF label sets", () => {
  it("returns English, Hindi and Gujarati labels without claiming e-invoice", () => {
    const en = getInvoicePdfLabels("en");
    const hi = getInvoicePdfLabels("hi");
    const gu = getInvoicePdfLabels("gu");
    expect(en.title).toBe("Tax Invoice");
    expect(hi.title).toContain("चालान");
    expect(gu.title.toLowerCase()).toContain("ઇનવૉઇસ".toLowerCase());
    for (const labels of [en, hi, gu]) {
      expect(labels.notEInvoice.toLowerCase()).toMatch(/e-invoice|ई-इनवॉइस|ઈ-ઇનવૉઇસ/);
      expect(labels.notEInvoice).toMatch(/IRN/);
    }
  });
});

/**
 * Simulates the FOR UPDATE counter pattern used in allocateInvoiceNumber:
 * concurrent finalizations serialize on the counter row.
 */
describe("invoice number sequence under concurrent finalization", () => {
  it("assigns contiguous numbers when allocations serialize on a lock", async () => {
    let lastNumber = 0;
    let locked = false;

    async function allocate(): Promise<number> {
      while (locked) {
        await new Promise((r) => setTimeout(r, 1));
      }
      locked = true;
      try {
        const next = lastNumber + 1;
        await new Promise((r) => setTimeout(r, 5));
        lastNumber = next;
        return next;
      } finally {
        locked = false;
      }
    }

    const results = await Promise.all([
      allocate(),
      allocate(),
      allocate(),
      allocate(),
      allocate(),
    ]);

    expect(results.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
    expect(lastNumber).toBe(5);
    expect(new Set(results).size).toBe(5);
  });
});

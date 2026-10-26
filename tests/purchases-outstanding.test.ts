import { describe, expect, it } from "vitest";
import {
  billOutstandingPaise,
  vendorOutstandingPaise,
} from "@/modules/purchases/outstanding";
import { purchaseOrderStatusFromLines } from "@/modules/purchases/po-status";

describe("vendor outstanding", () => {
  it("equals bills minus payments minus returns", () => {
    expect(
      vendorOutstandingPaise({
        billsPaise: 10_000_00,
        paymentsPaise: 3_000_00,
        returnsCreditPaise: 1_500_00,
      }),
    ).toBe(5_500_00);
  });

  it("can be zero when fully settled", () => {
    expect(
      vendorOutstandingPaise({
        billsPaise: 2_000_00,
        paymentsPaise: 1_500_00,
        returnsCreditPaise: 500_00,
      }),
    ).toBe(0);
  });
});

describe("bill outstanding", () => {
  it("never goes below zero", () => {
    expect(
      billOutstandingPaise({
        amountPaise: 100_00,
        paymentsPaise: 80_00,
        returnsCreditPaise: 50_00,
      }),
    ).toBe(0);
  });
});

describe("purchase order status from lines", () => {
  it("is PENDING when nothing received", () => {
    expect(
      purchaseOrderStatusFromLines([
        { quantityOrdered: 5, quantityReceived: 0 },
      ]),
    ).toBe("PENDING");
  });

  it("is PARTIALLY_RECEIVED when some received", () => {
    expect(
      purchaseOrderStatusFromLines([
        { quantityOrdered: 5, quantityReceived: 2 },
        { quantityOrdered: 3, quantityReceived: 0 },
      ]),
    ).toBe("PARTIALLY_RECEIVED");
  });

  it("is RECEIVED when all lines complete", () => {
    expect(
      purchaseOrderStatusFromLines([
        { quantityOrdered: 5, quantityReceived: 5 },
        { quantityOrdered: 2, quantityReceived: 2 },
      ]),
    ).toBe("RECEIVED");
  });
});

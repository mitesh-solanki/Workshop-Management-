import { describe, expect, it } from "vitest";
import {
  purchaseOrderReceiptStockNote,
  purchaseReturnStockNote,
} from "@/modules/purchases/stock-notes";

describe("purchase stock notes", () => {
  it("builds receipt and return notes from i18n messages", () => {
    expect(purchaseOrderReceiptStockNote("PO-12")).toBe("PO-12 receipt");
    expect(purchaseReturnStockNote()).toBe("Purchase return");
  });
});

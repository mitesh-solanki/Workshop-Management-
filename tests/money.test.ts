import { describe, expect, it } from "vitest";
import {
  add,
  formatRupees,
  isZeroRupeesInput,
  multiplyByQuantity,
  paiseToRupeesInput,
  parseRupeesToPaise,
  percentage,
  rupeesToPaiseSchema,
  sanitizeRupeesTyping,
} from "@/lib/money";

describe("money", () => {
  describe("add", () => {
    it("sums paise amounts", () => {
      expect(add(100, 250, 50)).toBe(400);
    });

    it("returns 0 for no arguments", () => {
      expect(add()).toBe(0);
    });

    it("rejects non-integer paise", () => {
      expect(() => add(10.5)).toThrow(/integer/);
    });
  });

  describe("multiplyByQuantity", () => {
    it("multiplies unit price by integer quantity", () => {
      expect(multiplyByQuantity(19900, 3)).toBe(59700);
    });

    it("rounds half-up for fractional quantities", () => {
      expect(multiplyByQuantity(100, 1.5)).toBe(150);
      expect(multiplyByQuantity(101, 0.5)).toBe(51);
    });

    it("rejects non-integer unit price", () => {
      expect(() => multiplyByQuantity(10.2, 1)).toThrow(/integer/);
    });
  });

  describe("percentage", () => {
    it("computes GST-style percentages with half-up rounding", () => {
      expect(percentage(10000, 18)).toBe(1800);
      // 999 * 18% = 179.82 → 180
      expect(percentage(999, 18)).toBe(180);
      // 1001 * 18% = 180.18 → 180
      expect(percentage(1001, 18)).toBe(180);
    });

    it("handles zero and full percent", () => {
      expect(percentage(5000, 0)).toBe(0);
      expect(percentage(5000, 100)).toBe(5000);
    });
  });

  describe("formatRupees", () => {
    it("formats paise as INR", () => {
      expect(formatRupees(0)).toBe("₹0.00");
      expect(formatRupees(100)).toBe("₹1.00");
      expect(formatRupees(125050)).toBe("₹1,250.50");
    });

    it("formats negative amounts", () => {
      expect(formatRupees(-250)).toBe("-₹2.50");
    });
  });

  describe("parseRupeesToPaise", () => {
    it("parses rupees and empty as paise", () => {
      expect(parseRupeesToPaise("")).toBe(0);
      expect(parseRupeesToPaise("250")).toBe(25000);
      expect(parseRupeesToPaise("250.50")).toBe(25050);
    });

    it("rejects invalid prices", () => {
      expect(parseRupeesToPaise("12.345")).toBeNull();
      expect(parseRupeesToPaise("abc")).toBeNull();
    });
  });

  describe("paiseToRupeesInput", () => {
    it("uses empty string for zero so the field has no sticky 0", () => {
      expect(paiseToRupeesInput(0)).toBe("");
      expect(paiseToRupeesInput(25000)).toBe("250");
      expect(paiseToRupeesInput(25050)).toBe("250.50");
    });
  });

  describe("isZeroRupeesInput", () => {
    it("detects empty and zero placeholders", () => {
      expect(isZeroRupeesInput("")).toBe(true);
      expect(isZeroRupeesInput("0")).toBe(true);
      expect(isZeroRupeesInput("260")).toBe(false);
    });
  });

  describe("rupeesToPaiseSchema", () => {
    it("transforms form values to paise", () => {
      expect(rupeesToPaiseSchema.parse("1200")).toBe(120000);
      expect(rupeesToPaiseSchema.parse("")).toBe(0);
    });
  });

  describe("sanitizeRupeesTyping", () => {
    it("strips letters and extra dots, caps decimals at 2", () => {
      expect(sanitizeRupeesTyping("250.556fcdf")).toBe("250.55");
      expect(sanitizeRupeesTyping("12.3.4")).toBe("12.34");
      expect(sanitizeRupeesTyping("abc")).toBe("");
    });
  });
});

import { describe, expect, it } from "vitest";
import { add, formatRupees, multiplyByQuantity, percentage } from "@/lib/money";

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
});

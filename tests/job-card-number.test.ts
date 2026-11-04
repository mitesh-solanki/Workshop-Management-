import { describe, expect, it } from "vitest";
import {
  formatJobCardNumberLabel,
  parseJobCardNumberInput,
} from "@/modules/service-orders/job-card-number";

describe("job card number helpers", () => {
  it("parses positive integers from strings and numbers", () => {
    expect(parseJobCardNumberInput(42)).toBe(42);
    expect(parseJobCardNumberInput("300")).toBe(300);
    expect(parseJobCardNumberInput(" 7 ")).toBe(7);
  });

  it("rejects invalid values", () => {
    expect(parseJobCardNumberInput(0)).toBeNull();
    expect(parseJobCardNumberInput(-1)).toBeNull();
    expect(parseJobCardNumberInput("01a")).toBeNull();
    expect(parseJobCardNumberInput("")).toBeNull();
    expect(parseJobCardNumberInput(null)).toBeNull();
  });

  it("formats a display label", () => {
    expect(formatJobCardNumberLabel(255)).toBe("#255");
  });
});

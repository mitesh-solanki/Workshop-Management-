import { describe, expect, it } from "vitest";
import {
  filterOutsideWorkSuggestions,
  OUTSIDE_WORK_SUGGESTIONS,
} from "@/modules/inspections/outside-work-suggestions";

describe("filterOutsideWorkSuggestions", () => {
  it("returns a capped list when the query is empty", () => {
    const result = filterOutsideWorkSuggestions("");
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(8);
    expect(OUTSIDE_WORK_SUGGESTIONS).toEqual(
      expect.arrayContaining(result),
    );
  });

  it("prefers prefix matches for outside work services", () => {
    expect(filterOutsideWorkSuggestions("wheel")).toEqual(
      expect.arrayContaining(["Wheel Alignment", "Wheel Balancing"]),
    );
  });

  it("finds denting and painting related services", () => {
    const result = filterOutsideWorkSuggestions("dent");
    expect(result.some((name) => name.toLowerCase().includes("dent"))).toBe(
      true,
    );
  });
});

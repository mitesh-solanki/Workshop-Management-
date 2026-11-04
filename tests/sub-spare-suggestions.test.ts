import { describe, expect, it } from "vitest";
import {
  filterInspectionMainPartNames,
  filterSubSpareSuggestions,
  getSubSpareSuggestions,
} from "@/modules/inspections/sub-spare-suggestions";

describe("filterInspectionMainPartNames", () => {
  it("suggests Brakes for brake, not Brake Disc", () => {
    const suggestions = filterInspectionMainPartNames("brake");
    expect(suggestions).toContain("Brakes");
    expect(suggestions.some((name) => name.includes("Pad"))).toBe(false);
    expect(suggestions.some((name) => name.includes("Disc"))).toBe(false);
  });
});

describe("filterSubSpareSuggestions", () => {
  it("filters Brake Pad when typing pad under Brakes", () => {
    const suggestions = filterSubSpareSuggestions("Brakes", "pad");
    expect(suggestions).toContain("Brake Pad");
    expect(suggestions.every((name) => name.toLowerCase().includes("pad"))).toBe(
      true,
    );
  });
});

describe("getSubSpareSuggestions", () => {
  it("returns brake-related parts for Brakes", () => {
    const suggestions = getSubSpareSuggestions("Brakes");
    expect(suggestions).toContain("Brake Pad");
    expect(suggestions).toContain("Brake Disc");
  });

  it("returns wheel-related suggestions for Wheel", () => {
    const suggestions = getSubSpareSuggestions("Wheel");
    expect(suggestions).toContain("Wheel Alignment");
    expect(suggestions).toContain("Wheel Balancing");
    expect(suggestions).toContain("Wheel Rim");
  });

  it("matches partial main labels like brake pad category via brake", () => {
    const suggestions = getSubSpareSuggestions("Front Brake");
    expect(suggestions.some((name) => name.toLowerCase().includes("brake"))).toBe(
      true,
    );
  });

  it("returns empty for unknown labels", () => {
    expect(getSubSpareSuggestions("Unknown Widget XYZ")).toEqual([]);
  });
});

describe("Wheel main spare", () => {
  it("suggests Wheel when typing whe", () => {
    expect(filterInspectionMainPartNames("whe")).toContain("Wheel");
  });
});

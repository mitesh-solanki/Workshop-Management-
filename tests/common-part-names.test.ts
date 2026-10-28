import { describe, expect, it } from "vitest";
import { filterCommonPartNames } from "@/modules/inventory/common-part-names";

describe("filterCommonPartNames", () => {
  it("returns nothing for blank query", () => {
    expect(filterCommonPartNames("")).toEqual([]);
    expect(filterCommonPartNames("   ")).toEqual([]);
  });

  it("matches starts-with before includes", () => {
    const results = filterCommonPartNames("clutch");
    expect(results[0]).toMatch(/^Clutch/i);
    expect(results).toContain("Clutch Wire");
  });

  it("does not suggest an exact match of the typed name", () => {
    expect(filterCommonPartNames("Clutch Wire")).not.toContain("Clutch Wire");
  });

  it("never auto-picks — only returns candidates", () => {
    const results = filterCommonPartNames("oil");
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(8);
  });
});

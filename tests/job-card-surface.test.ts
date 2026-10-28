import { describe, expect, it } from "vitest";
import {
  FULL_JOB_CARD_SURFACE,
  JOB_CARD_SECTIONS,
  TECHNICIAN_JOB_CARD_SECTIONS,
  TECHNICIAN_JOB_CARD_SURFACE,
  clampJobCardSection,
  jobCardSurfaceForRole,
} from "@/modules/service-orders/job-card-sections";

describe("job card surface by role", () => {
  it("keeps the full Owner/Manager surface unchanged", () => {
    for (const role of ["OWNER", "MANAGER", "ACCOUNTANT"] as const) {
      const surface = jobCardSurfaceForRole(role);
      expect(surface).toEqual(FULL_JOB_CARD_SURFACE);
      expect(surface.sections).toEqual(JOB_CARD_SECTIONS);
      expect(surface.hidePrices).toBe(false);
      expect(surface.includeCommercialSections).toBe(true);
    }
  });

  it("isolates the technician surface to three sections without prices", () => {
    const surface = jobCardSurfaceForRole("TECHNICIAN");
    expect(surface).toEqual(TECHNICIAN_JOB_CARD_SURFACE);
    expect(surface.sections).toEqual(TECHNICIAN_JOB_CARD_SECTIONS);
    expect(surface.hidePrices).toBe(true);
    expect(surface.includeCommercialSections).toBe(false);
    expect(surface.sections).not.toContain("estimate");
    expect(surface.sections).not.toContain("billing");
    expect(surface.sections).not.toContain("timeline");
  });

  it("clamps forbidden technician deep-links back to details", () => {
    expect(
      clampJobCardSection("billing", TECHNICIAN_JOB_CARD_SECTIONS),
    ).toBe("details");
    expect(
      clampJobCardSection("estimate", FULL_JOB_CARD_SURFACE.sections),
    ).toBe("estimate");
  });
});

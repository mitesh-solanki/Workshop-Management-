export const JOB_CARD_SECTIONS = [
  "details",
  "inspection",
  "lines",
  "estimate",
  "billing",
  "timeline",
] as const;

export type JobCardSection = (typeof JOB_CARD_SECTIONS)[number];

/** Technician-only surface — never used for Owner / Manager / Accountant. */
export const TECHNICIAN_JOB_CARD_SECTIONS = [
  "details",
  "inspection",
  "lines",
] as const satisfies readonly JobCardSection[];

export type TechnicianJobCardSection =
  (typeof TECHNICIAN_JOB_CARD_SECTIONS)[number];

export type JobCardSurface = {
  sections: readonly JobCardSection[];
  hidePrices: boolean;
  /** Load estimate / billing / timeline payloads. */
  includeCommercialSections: boolean;
};

/** Full garage job card — Owner, Manager, Accountant. */
export const FULL_JOB_CARD_SURFACE: JobCardSurface = {
  sections: JOB_CARD_SECTIONS,
  hidePrices: false,
  includeCommercialSections: true,
};

/** Restricted mechanic job card — Technician only. */
export const TECHNICIAN_JOB_CARD_SURFACE: JobCardSurface = {
  sections: TECHNICIAN_JOB_CARD_SECTIONS,
  hidePrices: true,
  includeCommercialSections: false,
};

export function isJobCardSection(
  value: string | null | undefined,
): value is JobCardSection {
  return (
    typeof value === "string" &&
    (JOB_CARD_SECTIONS as readonly string[]).includes(value)
  );
}

export function jobCardSurfaceForRole(role: string): JobCardSurface {
  if (role === "TECHNICIAN") {
    return TECHNICIAN_JOB_CARD_SURFACE;
  }
  return FULL_JOB_CARD_SURFACE;
}

/** @deprecated Prefer jobCardSurfaceForRole — kept for call sites that only need sections. */
export function jobCardSectionsForRole(
  role: string,
): readonly JobCardSection[] {
  return jobCardSurfaceForRole(role).sections;
}

export function clampJobCardSection(
  section: string | null | undefined,
  allowed: readonly JobCardSection[],
): JobCardSection {
  if (
    typeof section === "string" &&
    (allowed as readonly string[]).includes(section)
  ) {
    return section as JobCardSection;
  }
  return allowed[0] ?? "details";
}

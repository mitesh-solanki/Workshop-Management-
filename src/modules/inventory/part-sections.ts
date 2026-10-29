export const PART_SECTIONS = [
  "details",
  "stock",
  "boughtFrom",
  "requests",
  "history",
] as const;

export type PartSection = (typeof PART_SECTIONS)[number];

export const PART_SECTION_ID_PREFIX = "part-section-";

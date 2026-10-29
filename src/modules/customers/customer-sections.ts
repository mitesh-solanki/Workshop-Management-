export const CUSTOMER_SECTIONS = [
  "details",
  "vehicles",
  "service",
  "warranty",
  "communication",
] as const;

export type CustomerSection = (typeof CUSTOMER_SECTIONS)[number];

export const CUSTOMER_SECTION_ID_PREFIX = "customer-section-";

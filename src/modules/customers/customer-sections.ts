export const CUSTOMER_SECTIONS = [
  "details",
  "vehicles",
  "service",
  "communication",
] as const;

export type CustomerSection = (typeof CUSTOMER_SECTIONS)[number];

export const VEHICLE_SECTIONS = ["overview", "service"] as const;

export type VehicleSection = (typeof VEHICLE_SECTIONS)[number];

export const CUSTOMER_SECTION_ID_PREFIX = "customer-section-";
export const VEHICLE_SECTION_ID_PREFIX = "vehicle-section-";

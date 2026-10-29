export const VEHICLE_SECTIONS = ["overview", "warranty", "service"] as const;

export type VehicleSection = (typeof VEHICLE_SECTIONS)[number];

export const VEHICLE_SECTION_ID_PREFIX = "vehicle-section-";

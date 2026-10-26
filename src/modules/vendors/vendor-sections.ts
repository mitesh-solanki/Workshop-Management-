export const VENDOR_SECTION_ID_PREFIX = "vendor-section";

export const VENDOR_SECTIONS = [
  "details",
  "purchaseOrders",
  "bills",
  "returns",
] as const;

export type VendorSection = (typeof VENDOR_SECTIONS)[number];

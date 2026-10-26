export const VENDOR_BILL_SECTIONS = [
  "summary",
  "payments",
  "attachment",
  "returns",
] as const;

export type VendorBillSection = (typeof VENDOR_BILL_SECTIONS)[number];

export const VENDOR_BILL_SECTION_ID_PREFIX = "vendor-bill-section-";

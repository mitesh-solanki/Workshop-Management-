export const PURCHASE_ORDER_SECTIONS = [
  "summary",
  "lines",
  "receipts",
] as const;

export type PurchaseOrderSection = (typeof PURCHASE_ORDER_SECTIONS)[number];

export const PURCHASE_ORDER_SECTION_ID_PREFIX = "po-section-";

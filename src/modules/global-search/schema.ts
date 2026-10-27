/** Client-safe global search types and constants (no Prisma). */

export const GLOBAL_SEARCH_MIN_CHARS = 2;
export const GLOBAL_SEARCH_PER_TYPE = 5;

export const GLOBAL_SEARCH_ENTITY_TYPES = [
  "customer",
  "vehicle",
  "order",
  "part",
  "vendor",
  "invoice",
] as const;

export type GlobalSearchEntityType = (typeof GLOBAL_SEARCH_ENTITY_TYPES)[number];

export const GLOBAL_SEARCH_MATCH_FIELDS = [
  "name",
  "phone",
  "registration",
  "make",
  "model",
  "complaint",
  "sku",
  "hsn",
  "gstin",
  "email",
  "invoiceNumber",
] as const;

export type GlobalSearchMatchField = (typeof GLOBAL_SEARCH_MATCH_FIELDS)[number];

export type GlobalSearchResult = {
  id: string;
  type: GlobalSearchEntityType;
  title: string;
  subtitle?: string;
  matchIn: GlobalSearchMatchField;
  href: string;
};

/** Indian GSTIN format and state-code helpers (UI validation only). */

export const GSTIN_REGEX =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** Known GST state / UT codes (names live in messages under gst.states.*). */
export const GST_STATE_CODES = [
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
  "21",
  "22",
  "23",
  "24",
  "25",
  "26",
  "27",
  "28",
  "29",
  "30",
  "31",
  "32",
  "33",
  "34",
  "35",
  "36",
  "37",
  "38",
  "97",
  "99",
] as const;

export type GstStateCode = (typeof GST_STATE_CODES)[number];

const GST_STATE_CODE_SET = new Set<string>(GST_STATE_CODES);

export function normalizeGstin(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function isValidGstin(value: string): boolean {
  if (!value) return true;
  return GSTIN_REGEX.test(normalizeGstin(value));
}

export function gstinStateCode(value: string): string | null {
  const normalized = normalizeGstin(value);
  if (normalized.length < 2) return null;
  const code = normalized.slice(0, 2);
  if (!/^\d{2}$/.test(code)) return null;
  return code;
}

/** True when the code is a known GST state / UT code. */
export function isKnownGstStateCode(code: string): code is GstStateCode {
  return GST_STATE_CODE_SET.has(code);
}

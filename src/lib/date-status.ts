export type DateStatus = "unset" | "ok" | "soon" | "expired";

const SOON_DAYS = 30;

/** Classify an expiry date for UI badges (garage compliance dates). */
export function getDateStatus(
  value: Date | null,
  now: Date = new Date(),
): DateStatus {
  if (!value) {
    return "unset";
  }
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfValue = new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
  );
  if (startOfValue.getTime() < startOfToday.getTime()) {
    return "expired";
  }
  const soonMs = SOON_DAYS * 24 * 60 * 60 * 1000;
  if (startOfValue.getTime() - startOfToday.getTime() <= soonMs) {
    return "soon";
  }
  return "ok";
}

/**
 * Shared contact helpers (aligned with Cruise Holiday admin forms).
 * Use for phone/email typing filters and validation across modules.
 */

/** Email shape check — empty string is not valid. */
export function isValidEmail(email: string): boolean {
  if (!email.trim()) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Phone check — optional +, spaces, dashes, parentheses.
 * Requires 7–15 digits.
 */
export function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/[^\d]/g, "");
  return cleaned.length >= 7 && cleaned.length <= 15;
}

/**
 * While typing: keep optional leading +, digits only after that.
 * Blocks letters and other symbols.
 */
export function sanitizePhoneTyping(value: string): string {
  const trimmedStart = value.trimStart();
  const wantsPlus = trimmedStart.startsWith("+");
  const digits = value.replace(/\D/g, "").slice(0, 15);
  if (wantsPlus) {
    return digits.length > 0 ? `+${digits}` : "+";
  }
  return digits;
}

/** Soft email typing cleanup — trim leading spaces only. */
export function sanitizeEmailTyping(value: string): string {
  return value.replace(/^\s+/, "");
}

import { compare, hash } from "bcryptjs";

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_HASH_ROUNDS = 12;
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
export const LOGIN_LOCKOUT_ATTEMPTS = 5;
export const LOGIN_LOCKOUT_MS = 30 * 60 * 1000;

export const PASSWORD_HINT =
  "At least 8 characters, with one capital letter, one number, and one special character.";

/** Returns an i18n validation key, or null if the password is ok. */
export function passwordPolicyErrorKey(password: string): string | null {
  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    return "validation.passwordTooShort";
  }
  if (!/[A-Z]/.test(password)) {
    return "validation.passwordNeedsUpper";
  }
  if (!/[0-9]/.test(password)) {
    return "validation.passwordNeedsNumber";
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return "validation.passwordNeedsSpecial";
  }
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, PASSWORD_HASH_ROUNDS);
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return compare(password, passwordHash);
}

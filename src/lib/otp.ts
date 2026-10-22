import "server-only";

import { createHash, randomInt } from "node:crypto";
import bcrypt from "bcryptjs";

const OTP_PEPPER = process.env.AUTH_SECRET ?? "dev-otp-pepper";

export const OTP_TTL_MS = 10 * 60 * 1000;

export type OtpPurpose = "login" | "signup" | "invite";

export type OtpPayload = {
  name?: string;
  garageName?: string;
  inviteToken?: string;
  locale?: string;
};

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashInviteToken(token: string) {
  return createHash("sha256").update(`${token}:${OTP_PEPPER}`).digest("hex");
}

export function hashToken(token: string) {
  return hashInviteToken(token);
}

/**
 * Fixed OTP only for automated local/e2e when NODE_ENV !== "production".
 * Never used in production. UI must never display the code — delivery is via Resend.
 */
export function generateOtpCode() {
  const fixed = process.env.AUTH_DEV_OTP?.trim();
  if (process.env.NODE_ENV !== "production" && fixed) {
    return fixed;
  }
  return String(randomInt(100000, 1000000));
}

export async function hashOtpCode(code: string) {
  return bcrypt.hash(code, 10);
}

export async function compareOtpCode(code: string, codeHash: string) {
  return bcrypt.compare(code, codeHash);
}

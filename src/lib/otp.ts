import "server-only";

import { createHash, randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_PEPPER = process.env.AUTH_SECRET ?? "dev-otp-pepper";

export type OtpPurpose = "login" | "signup" | "invite";

export type OtpPayload = {
  name?: string;
  garageName?: string;
  inviteToken?: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashInviteToken(token: string) {
  return createHash("sha256").update(`${token}:${OTP_PEPPER}`).digest("hex");
}

export function hashToken(token: string) {
  return hashInviteToken(token);
}

function generateCode() {
  const fixed = process.env.AUTH_DEV_OTP;
  if (process.env.NODE_ENV !== "production" && fixed) {
    return fixed;
  }
  return String(randomInt(100000, 1000000));
}

async function sendOtpEmail(email: string, code: string) {
  // Dev-friendly transport until a real mailer is wired.
  console.info(`[otp] ${email}: ${code}`);
}

export async function createEmailOtp(input: {
  email: string;
  purpose: OtpPurpose;
  payload?: OtpPayload;
}) {
  const email = normalizeEmail(input.email);
  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 10);

  await prisma.emailOtp.updateMany({
    where: { email, purpose: input.purpose, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  await prisma.emailOtp.create({
    data: {
      email,
      codeHash,
      purpose: input.purpose,
      payload: input.payload ?? undefined,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  await sendOtpEmail(email, code);

  return { email, expiresInSeconds: OTP_TTL_MS / 1000 };
}

export async function consumeEmailOtp(input: {
  email: string;
  code: string;
  purpose?: OtpPurpose;
}) {
  const email = normalizeEmail(input.email);
  const rows = await prisma.emailOtp.findMany({
    where: {
      email,
      consumedAt: null,
      expiresAt: { gt: new Date() },
      ...(input.purpose ? { purpose: input.purpose } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  for (const row of rows) {
    const ok = await bcrypt.compare(input.code, row.codeHash);
    if (!ok) continue;

    await prisma.emailOtp.update({
      where: { id: row.id },
      data: { consumedAt: new Date() },
    });

    return {
      email,
      purpose: row.purpose as OtpPurpose,
      payload: (row.payload ?? null) as OtpPayload | null,
    };
  }

  throw new AppError("INVALID_OTP", "Invalid or expired code", 401);
}

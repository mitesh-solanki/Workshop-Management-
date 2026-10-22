import "server-only";

import {
  getAppUrl,
  renderOtpEmail,
  sendLoggedEmail,
} from "@/lib/email";
import { AppError } from "@/lib/errors";
import {
  MAX_OTP_ATTEMPTS,
  OTP_EMAIL_RATE,
  OTP_IP_RATE,
  consumeRateLimit,
} from "@/lib/rate-limit";
import {
  OTP_TTL_MS,
  compareOtpCode,
  generateOtpCode,
  hashOtpCode,
  hashToken,
  normalizeEmail,
  type OtpPayload,
  type OtpPurpose,
} from "@/lib/otp";
import {
  acceptInviteAndCreateUser,
  createEmailOtpRow,
  createOwnerWithGarage,
  createPrismaAuthAdapter,
  findLatestEmailOtp,
  findPendingInviteByEmail,
  findPendingInviteByTokenHash,
  findUserByEmailForLogin,
  findUserByIdForSessionRefresh,
  incrementEmailOtpAttempts,
  invalidateOpenEmailOtps,
  markEmailOtpConsumed,
} from "@/modules/auth/repo";
import {
  requestInviteOtpSchema,
  requestLoginOtpSchema,
  requestSignupOtpSchema,
  verifyOtpSchema,
  type RequestInviteOtpInput,
  type RequestLoginOtpInput,
  type RequestSignupOtpInput,
  type VerifyOtpInput,
} from "@/modules/auth/schema";

export function getAuthAdapter() {
  return createPrismaAuthAdapter();
}

export async function getUserForSessionRefresh(userId: string) {
  return findUserByIdForSessionRefresh(userId);
}

async function enforceOtpRequestLimits(email: string, ip?: string) {
  const emailLimit = await consumeRateLimit({
    key: `otp:email:${email}`,
    limit: OTP_EMAIL_RATE.limit,
    windowMs: OTP_EMAIL_RATE.windowMs,
  });
  if (!emailLimit.allowed) {
    throw new AppError("auth.rate_limited", 429);
  }

  if (ip && ip !== "unknown") {
    const ipLimit = await consumeRateLimit({
      key: `otp:ip:${ip}`,
      limit: OTP_IP_RATE.limit,
      windowMs: OTP_IP_RATE.windowMs,
    });
    if (!ipLimit.allowed) {
      throw new AppError("auth.rate_limited", 429);
    }
  }
}

function otpEmailType(purpose: OtpPurpose) {
  if (purpose === "signup") return "signup_otp" as const;
  if (purpose === "invite") return "invite_otp" as const;
  return "login_otp" as const;
}

export async function createEmailOtp(input: {
  email: string;
  purpose: OtpPurpose;
  payload?: OtpPayload;
  locale?: string | null;
  ip?: string;
}) {
  const email = normalizeEmail(input.email);
  await enforceOtpRequestLimits(email, input.ip);

  const code = generateOtpCode();
  const codeHash = await hashOtpCode(code);
  const locale = input.locale ?? input.payload?.locale ?? "en";

  await invalidateOpenEmailOtps({ email, purpose: input.purpose });
  await createEmailOtpRow({
    email,
    codeHash,
    purpose: input.purpose,
    payload: { ...input.payload, locale },
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });

  const rendered = renderOtpEmail({ code, locale });
  const sent = await sendLoggedEmail({
    type: otpEmailType(input.purpose),
    to: email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  });

  // Local/dev with AUTH_DEV_OTP: allow verify with the fixed code even if
  // Resend fails. Never return or surface the code in the UI.
  const allowDevOtpBypass =
    process.env.NODE_ENV !== "production" &&
    Boolean(process.env.AUTH_DEV_OTP?.trim());

  if (!sent.ok && !allowDevOtpBypass) {
    throw new AppError("auth.email_send_failed", 502);
  }

  return { email, expiresInSeconds: OTP_TTL_MS / 1000 };
}

export async function consumeEmailOtp(input: {
  email: string;
  code: string;
  purpose?: OtpPurpose;
}) {
  const email = normalizeEmail(input.email);
  const row = await findLatestEmailOtp({
    email,
    purpose: input.purpose,
  });

  if (!row) {
    throw new AppError("auth.invalid_otp", 401);
  }

  if (row.consumedAt) {
    throw new AppError("auth.invalid_otp", 401);
  }

  if (row.expiresAt.getTime() <= Date.now()) {
    throw new AppError("auth.invalid_otp", 401);
  }

  if (row.attempts >= MAX_OTP_ATTEMPTS) {
    throw new AppError("auth.invalid_otp", 401);
  }

  const ok = await compareOtpCode(input.code, row.codeHash);
  if (!ok) {
    const updated = await incrementEmailOtpAttempts(row.id);
    if (updated.attempts >= MAX_OTP_ATTEMPTS) {
      await markEmailOtpConsumed(row.id);
    }
    throw new AppError("auth.invalid_otp", 401);
  }

  await markEmailOtpConsumed(row.id);

  return {
    email,
    purpose: row.purpose as OtpPurpose,
    payload: (row.payload ?? null) as OtpPayload | null,
  };
}

export async function requestSignupOtp(
  raw: RequestSignupOtpInput,
  opts?: { locale?: string | null; ip?: string },
) {
  const input = requestSignupOtpSchema.parse(raw);
  const email = normalizeEmail(input.email);

  const existing = await findUserByEmailForLogin(email);
  if (existing) {
    throw new AppError("auth.email_in_use");
  }

  return createEmailOtp({
    email,
    purpose: "signup",
    locale: opts?.locale,
    ip: opts?.ip,
    payload: {
      name: input.name.trim(),
      garageName: input.garageName.trim(),
    },
  });
}

export async function requestLoginOtp(
  raw: RequestLoginOtpInput,
  opts?: { locale?: string | null; ip?: string },
) {
  const input = requestLoginOtpSchema.parse(raw);
  const email = normalizeEmail(input.email);

  const existing = await findUserByEmailForLogin(email);
  if (!existing) {
    const invite = await findPendingInviteByEmail(email);
    if (!invite) {
      // Avoid account enumeration.
      return { email, expiresInSeconds: 600 };
    }
    return createEmailOtp({
      email,
      purpose: "invite",
      locale: opts?.locale ?? invite.locale,
      ip: opts?.ip,
      payload: { name: email.split("@")[0] || email },
    });
  }

  return createEmailOtp({
    email,
    purpose: "login",
    locale: opts?.locale,
    ip: opts?.ip,
  });
}

export async function requestInviteOtp(
  raw: RequestInviteOtpInput,
  opts?: { locale?: string | null; ip?: string },
) {
  const input = requestInviteOtpSchema.parse(raw);
  const invite = await findPendingInviteByTokenHash(hashToken(input.token));
  if (!invite) {
    throw new AppError("auth.invalid_invite", 404);
  }

  const existing = await findUserByEmailForLogin(invite.email);
  if (existing) {
    throw new AppError("auth.email_in_use");
  }

  return createEmailOtp({
    email: invite.email,
    purpose: "invite",
    locale: opts?.locale ?? invite.locale,
    ip: opts?.ip,
    payload: {
      name: input.name.trim(),
      inviteToken: input.token,
    },
  });
}

export async function completeOtpSignIn(raw: VerifyOtpInput) {
  const input = verifyOtpSchema.parse(raw);
  const email = normalizeEmail(input.email);
  const otp = await consumeEmailOtp({ email, code: input.code });

  if (otp.purpose === "signup") {
    const name = otp.payload?.name?.trim();
    const garageName = otp.payload?.garageName?.trim();
    if (!name || !garageName) {
      throw new AppError("auth.signup_incomplete");
    }

    const existing = await findUserByEmailForLogin(email);
    if (existing) {
      return existing;
    }

    const { user } = await createOwnerWithGarage({ email, name, garageName });
    return user;
  }

  if (otp.purpose === "invite") {
    const invite =
      otp.payload?.inviteToken != null
        ? await findPendingInviteByTokenHash(hashToken(otp.payload.inviteToken))
        : await findPendingInviteByEmail(email);

    if (!invite) {
      throw new AppError("auth.invalid_invite", 404);
    }

    const existing = await findUserByEmailForLogin(email);
    if (existing) {
      return existing;
    }

    const name = otp.payload?.name?.trim() || email.split("@")[0] || email;

    return acceptInviteAndCreateUser({
      inviteId: invite.id,
      email,
      name,
      role: invite.role,
      garageId: invite.garageId,
    });
  }

  const user = await findUserByEmailForLogin(email);
  if (!user) {
    throw new AppError("auth.user_not_found", 404);
  }
  return user;
}

/** Exported for tests that assert invite accept URLs. */
export function inviteAcceptUrl(token: string) {
  return `${getAppUrl().replace(/\/$/, "")}/invite/${token}`;
}

import "server-only";

import { timingSafeEqual } from "node:crypto";
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
  PROD_PASSWORD_EMAIL_RATE,
  PROD_PASSWORD_IP_RATE,
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
  ensureTechnicianInGarage,
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
  prodPasswordLoginSchema,
  requestInviteOtpSchema,
  requestLoginOtpSchema,
  requestSignupOtpSchema,
  verifyOtpSchema,
  type ProdPasswordLoginInput,
  type RequestInviteOtpInput,
  type RequestLoginOtpInput,
  type RequestSignupOtpInput,
  type VerifyOtpInput,
} from "@/modules/auth/schema";

function safeEqualString(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) {
    timingSafeEqual(aBuf, aBuf);
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}

function getProdPasswordConfig() {
  const email = process.env.AUTH_PROD_EMAIL?.trim();
  const password = process.env.AUTH_PROD_PASSWORD?.trim();
  const name = process.env.AUTH_PROD_NAME?.trim() || "Prime Motors Owner";
  const garageName =
    process.env.AUTH_PROD_GARAGE_NAME?.trim() || "Prime Motors";

  if (!email || !password) {
    return null;
  }

  return {
    email: normalizeEmail(email),
    password,
    name,
    garageName,
  };
}

/** Dummy mechanic for the production garage (assignment + optional password login). */
function getProdTechnicianConfig(ownerPassword: string) {
  const email = normalizeEmail(
    process.env.AUTH_PROD_TECH_EMAIL?.trim() || "mechanic@primemotors.in",
  );
  const name =
    process.env.AUTH_PROD_TECH_NAME?.trim() || "Demo Mechanic";
  const password =
    process.env.AUTH_PROD_TECH_PASSWORD?.trim() || ownerPassword;

  return { email, name, password };
}

/** True only in production when AUTH_PROD_EMAIL and AUTH_PROD_PASSWORD are set. */
export function isProdPasswordLoginEnabled() {
  return (
    process.env.NODE_ENV === "production" && getProdPasswordConfig() !== null
  );
}

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

async function ensureProdDummyMechanic(garageId: string, actorId?: string) {
  const ownerConfig = getProdPasswordConfig();
  if (!ownerConfig) {
    return null;
  }
  const tech = getProdTechnicianConfig(ownerConfig.password);
  return ensureTechnicianInGarage({
    garageId,
    email: tech.email,
    name: tech.name,
    actorId,
  });
}

export async function completeProdPasswordSignIn(
  raw: ProdPasswordLoginInput,
  opts?: { ip?: string },
) {
  if (process.env.NODE_ENV !== "production") {
    throw new AppError("auth.invalid_credentials", 401);
  }

  const config = getProdPasswordConfig();
  if (!config) {
    throw new AppError("auth.invalid_credentials", 401);
  }

  const techConfig = getProdTechnicianConfig(config.password);
  const input = prodPasswordLoginSchema.parse(raw);
  const email = normalizeEmail(input.email);

  const emailLimit = await consumeRateLimit({
    key: `prod-password:email:${email}`,
    limit: PROD_PASSWORD_EMAIL_RATE.limit,
    windowMs: PROD_PASSWORD_EMAIL_RATE.windowMs,
  });
  if (!emailLimit.allowed) {
    throw new AppError("auth.rate_limited", 429);
  }

  if (opts?.ip && opts.ip !== "unknown") {
    const ipLimit = await consumeRateLimit({
      key: `prod-password:ip:${opts.ip}`,
      limit: PROD_PASSWORD_IP_RATE.limit,
      windowMs: PROD_PASSWORD_IP_RATE.windowMs,
    });
    if (!ipLimit.allowed) {
      throw new AppError("auth.rate_limited", 429);
    }
  }

  const isOwnerEmail = safeEqualString(email, config.email);
  const isTechEmail = safeEqualString(email, techConfig.email);

  if (isOwnerEmail) {
    const passwordOk = safeEqualString(input.password, config.password);
    if (!passwordOk) {
      throw new AppError("auth.invalid_credentials", 401);
    }

    const existing = await findUserByEmailForLogin(email);
    if (existing) {
      await ensureProdDummyMechanic(existing.garageId, existing.id);
      return existing;
    }

    const { user } = await createOwnerWithGarage({
      email,
      name: config.name,
      garageName: config.garageName,
    });
    await ensureProdDummyMechanic(user.garageId, user.id);
    return user;
  }

  if (isTechEmail) {
    const passwordOk = safeEqualString(input.password, techConfig.password);
    if (!passwordOk) {
      throw new AppError("auth.invalid_credentials", 401);
    }

    const existingTech = await findUserByEmailForLogin(email);
    if (existingTech && existingTech.role === "TECHNICIAN") {
      return existingTech;
    }

    const owner = await findUserByEmailForLogin(config.email);
    if (!owner) {
      throw new AppError("auth.invalid_credentials", 401);
    }

    return ensureTechnicianInGarage({
      garageId: owner.garageId,
      email: techConfig.email,
      name: techConfig.name,
      actorId: owner.id,
    });
  }

  throw new AppError("auth.invalid_credentials", 401);
}

/** Exported for tests that assert invite accept URLs. */
export function inviteAcceptUrl(token: string) {
  return `${getAppUrl().replace(/\/$/, "")}/invite/${token}`;
}

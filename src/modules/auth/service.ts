import "server-only";

import { timingSafeEqual } from "node:crypto";
import { randomBytes } from "node:crypto";
import {
  getAppUrl,
  renderOtpEmail,
  renderPasswordResetEmail,
  sendLoggedEmail,
} from "@/lib/email";
import { writeAuditLog } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import {
  LOGIN_LOCKOUT_ATTEMPTS,
  LOGIN_LOCKOUT_MS,
  PASSWORD_RESET_TTL_MS,
  hashPassword,
  verifyPassword,
} from "@/lib/password";
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
  clearLoginFailures,
  createEmailOtpRow,
  createOwnerWithGarage,
  createPrismaAuthAdapter,
  ensureTechnicianInGarage,
  findLatestEmailOtp,
  findPendingInviteByEmail,
  findPendingInviteByTokenHash,
  findGarageNameById,
  findUserByEmailForLogin,
  findUserByIdForPasswordChange,
  findUserByIdForSessionRefresh,
  findUserByPasswordResetTokenHash,
  incrementEmailOtpAttempts,
  invalidateOpenEmailOtps,
  markEmailOtpConsumed,
  recordFailedLogin,
  setPasswordResetToken,
  setUserPasswordHash,
  updateOwnNameInGarage,
} from "@/modules/auth/repo";
import {
  acceptInviteWithPasswordSchema,
  changeOwnNameSchema,
  changeOwnPasswordSchema,
  forgotPasswordSchema,
  passwordLoginSchema,
  requestInviteOtpSchema,
  requestLoginOtpSchema,
  requestSignupOtpSchema,
  resetPasswordSchema,
  signupWithPasswordSchema,
  verifyOtpSchema,
  type AcceptInviteWithPasswordInput,
  type ChangeOwnNameInput,
  type ChangeOwnPasswordInput,
  type ForgotPasswordInput,
  type PasswordLoginInput,
  type ProdPasswordLoginInput,
  type RequestInviteOtpInput,
  type RequestLoginOtpInput,
  type RequestSignupOtpInput,
  type ResetPasswordInput,
  type SignupWithPasswordInput,
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

/** Password login is the primary staff path in every environment. */
export function isPasswordLoginEnabled() {
  return true;
}

/** @deprecated Use isPasswordLoginEnabled */
export function isProdPasswordLoginEnabled() {
  return isPasswordLoginEnabled();
}

/** OTP login stays for local/dev (and customer flows later) — not primary staff login. */
export function isOtpLoginEnabled() {
  return process.env.NODE_ENV !== "production";
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
    throw new AppError("auth.use_invite_password", 400);
  }

  const user = await findUserByEmailForLogin(email);
  if (!user || !user.isActive) {
    throw new AppError("auth.user_not_found", 404);
  }
  return user;
}

async function ensureBootstrapMechanic(
  garageId: string,
  actorId: string | undefined,
  plainPassword: string,
) {
  const ownerConfig = getProdPasswordConfig();
  if (!ownerConfig) {
    return null;
  }
  const tech = getProdTechnicianConfig(ownerConfig.password);
  const passwordHash = await hashPassword(plainPassword);
  return ensureTechnicianInGarage({
    garageId,
    email: tech.email,
    name: tech.name,
    actorId,
    passwordHash,
  });
}

async function enforcePasswordLoginLimits(email: string, ip?: string) {
  const emailLimit = await consumeRateLimit({
    key: `password:email:${email}`,
    limit: PROD_PASSWORD_EMAIL_RATE.limit,
    windowMs: PROD_PASSWORD_EMAIL_RATE.windowMs,
  });
  if (!emailLimit.allowed) {
    throw new AppError("auth.rate_limited", 429);
  }

  if (ip && ip !== "unknown") {
    const ipLimit = await consumeRateLimit({
      key: `password:ip:${ip}`,
      limit: PROD_PASSWORD_IP_RATE.limit,
      windowMs: PROD_PASSWORD_IP_RATE.windowMs,
    });
    if (!ipLimit.allowed) {
      throw new AppError("auth.rate_limited", 429);
    }
  }
}

async function failPasswordLogin(userId: string, attempts: number) {
  const nextAttempts = attempts + 1;
  const lockoutUntil =
    nextAttempts >= LOGIN_LOCKOUT_ATTEMPTS
      ? new Date(Date.now() + LOGIN_LOCKOUT_MS)
      : null;
  await recordFailedLogin(userId, lockoutUntil);
  throw new AppError("auth.invalid_credentials", 401);
}

/**
 * Email + password sign-in for Owner, Technician, and other staff.
 * Also bootstraps AUTH_PROD_* owner/mechanic when those env vars match.
 */
export async function completePasswordSignIn(
  raw: PasswordLoginInput,
  opts?: { ip?: string },
) {
  const input = passwordLoginSchema.parse(raw);
  const email = normalizeEmail(input.email);
  await enforcePasswordLoginLimits(email, opts?.ip);

  const existing = await findUserByEmailForLogin(email);
  if (existing) {
    if (!existing.isActive) {
      throw new AppError("auth.invalid_credentials", 401);
    }
    if (
      existing.lockoutUntil &&
      existing.lockoutUntil.getTime() > Date.now()
    ) {
      throw new AppError("auth.rate_limited", 429);
    }

    if (existing.passwordHash) {
      const ok = await verifyPassword(input.password, existing.passwordHash);
      if (!ok) {
        await failPasswordLogin(existing.id, existing.failedLoginAttempts);
      }
      await clearLoginFailures(existing.id);
      return existing;
    }
  }

  const config = getProdPasswordConfig();
  if (!config) {
    throw new AppError("auth.invalid_credentials", 401);
  }

  const techConfig = getProdTechnicianConfig(config.password);
  const isOwnerEmail = safeEqualString(email, config.email);
  const isTechEmail = safeEqualString(email, techConfig.email);

  if (isOwnerEmail) {
    const passwordOk = safeEqualString(input.password, config.password);
    if (!passwordOk) {
      if (existing) {
        await failPasswordLogin(existing.id, existing.failedLoginAttempts);
      }
      throw new AppError("auth.invalid_credentials", 401);
    }

    const passwordHash = await hashPassword(config.password);
    if (existing) {
      await setUserPasswordHash(existing.id, passwordHash);
      await ensureBootstrapMechanic(
        existing.garageId,
        existing.id,
        techConfig.password,
      );
      return findUserByEmailForLogin(email).then((row) => {
        if (!row) throw new AppError("auth.invalid_credentials", 401);
        return row;
      });
    }

    const { user } = await createOwnerWithGarage({
      email,
      name: config.name,
      garageName: config.garageName,
      passwordHash,
    });
    await ensureBootstrapMechanic(user.garageId, user.id, techConfig.password);
    return user;
  }

  if (isTechEmail) {
    const passwordOk = safeEqualString(input.password, techConfig.password);
    if (!passwordOk) {
      if (existing) {
        await failPasswordLogin(existing.id, existing.failedLoginAttempts);
      }
      throw new AppError("auth.invalid_credentials", 401);
    }

    const passwordHash = await hashPassword(techConfig.password);
    if (existing && existing.role === "TECHNICIAN") {
      await setUserPasswordHash(existing.id, passwordHash);
      return findUserByEmailForLogin(email).then((row) => {
        if (!row) throw new AppError("auth.invalid_credentials", 401);
        return row;
      });
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
      passwordHash,
    });
  }

  throw new AppError("auth.invalid_credentials", 401);
}

/** @deprecated Use completePasswordSignIn */
export async function completeProdPasswordSignIn(
  raw: ProdPasswordLoginInput,
  opts?: { ip?: string },
) {
  return completePasswordSignIn(raw, opts);
}

export async function signupOwnerWithPassword(
  raw: SignupWithPasswordInput,
) {
  const input = signupWithPasswordSchema.parse(raw);
  const email = normalizeEmail(input.email);

  const existing = await findUserByEmailForLogin(email);
  if (existing) {
    throw new AppError("auth.email_in_use");
  }

  const passwordHash = await hashPassword(input.password);
  const { user } = await createOwnerWithGarage({
    email,
    name: input.name.trim(),
    garageName: input.garageName.trim(),
    passwordHash,
  });
  return user;
}

export async function acceptInviteWithPassword(
  raw: AcceptInviteWithPasswordInput,
) {
  const input = acceptInviteWithPasswordSchema.parse(raw);
  const invite = await findPendingInviteByTokenHash(hashToken(input.token));
  if (!invite) {
    throw new AppError("auth.invalid_invite", 404);
  }

  const existing = await findUserByEmailForLogin(invite.email);
  if (existing) {
    throw new AppError("auth.email_in_use");
  }

  const passwordHash = await hashPassword(input.password);
  return acceptInviteAndCreateUser({
    inviteId: invite.id,
    email: invite.email,
    name: input.name.trim(),
    role: invite.role,
    garageId: invite.garageId,
    passwordHash,
  });
}

export async function requestPasswordReset(
  raw: ForgotPasswordInput,
  opts?: { locale?: string | null; ip?: string },
) {
  const input = forgotPasswordSchema.parse(raw);
  const email = normalizeEmail(input.email);
  await enforcePasswordLoginLimits(email, opts?.ip);

  const user = await findUserByEmailForLogin(email);
  // Avoid account enumeration — always look successful.
  if (!user || !user.isActive || !user.passwordHash) {
    return { email, resetUrl: null as string | null, emailSent: false };
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
  await setPasswordResetToken({
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt,
  });

  const garage = await findGarageNameById(user.garageId);
  const resetUrl = `${getAppUrl().replace(/\/$/, "")}/reset-password/${token}`;
  const rendered = renderPasswordResetEmail({
    resetUrl,
    expiresAt,
    garageName: garage?.name ?? "Workshop",
    memberName: user.name,
    adminRequested: false,
    locale: opts?.locale,
  });
  const sent = await sendLoggedEmail({
    type: "password_reset",
    to: email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  });

  // Without a mail domain, still return the link so the owner can open it.
  return {
    email,
    resetUrl: sent.ok ? null : resetUrl,
    emailSent: sent.ok,
  };
}

export async function resetPasswordWithToken(raw: ResetPasswordInput) {
  const input = resetPasswordSchema.parse(raw);
  const user = await findUserByPasswordResetTokenHash(hashToken(input.token));
  if (!user) {
    throw new AppError("auth.invalid_reset_token", 400);
  }

  if (user.passwordHash) {
    const same = await verifyPassword(input.password, user.passwordHash);
    if (same) {
      throw new AppError("auth.password_reuse", 400);
    }
  }

  const passwordHash = await hashPassword(input.password);
  await setUserPasswordHash(user.id, passwordHash);
  return { email: user.email };
}

export async function changeOwnPassword(
  session: { userId: string; garageId: string },
  raw: ChangeOwnPasswordInput,
) {
  const input = changeOwnPasswordSchema.parse(raw);
  const user = await findUserByIdForPasswordChange(session.userId);
  if (!user || !user.isActive || user.garageId !== session.garageId) {
    throw new AppError("auth.user_not_found", 404);
  }
  if (!user.passwordHash) {
    throw new AppError("auth.wrong_current_password", 400);
  }

  const currentOk = await verifyPassword(
    input.currentPassword,
    user.passwordHash,
  );
  if (!currentOk) {
    throw new AppError("auth.wrong_current_password", 400);
  }

  const same = await verifyPassword(input.password, user.passwordHash);
  if (same) {
    throw new AppError("auth.password_reuse", 400);
  }

  const passwordHash = await hashPassword(input.password);
  await setUserPasswordHash(user.id, passwordHash);

  await writeAuditLog({
    garageId: session.garageId,
    actorId: session.userId,
    action: "user.password_changed",
    entity: "User",
    entityId: user.id,
    meta: { self: true },
  });
}

export async function changeOwnName(
  session: { userId: string; garageId: string },
  raw: ChangeOwnNameInput,
) {
  const input = changeOwnNameSchema.parse(raw);
  const updated = await updateOwnNameInGarage({
    garageId: session.garageId,
    userId: session.userId,
    name: input.name,
  });
  if (updated.count === 0) {
    throw new AppError("auth.user_not_found", 404);
  }

  await writeAuditLog({
    garageId: session.garageId,
    actorId: session.userId,
    action: "user.name_changed",
    entity: "User",
    entityId: session.userId,
    meta: { name: input.name, self: true },
  });

  return { name: input.name };
}

/** Exported for tests that assert invite accept URLs. */
export function inviteAcceptUrl(token: string) {
  return `${getAppUrl().replace(/\/$/, "")}/invite/${token}`;
}

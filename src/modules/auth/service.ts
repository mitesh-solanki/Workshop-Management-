import "server-only";

import { AppError } from "@/lib/errors";
import { consumeEmailOtp, createEmailOtp, hashToken } from "@/lib/otp";
import {
  acceptInviteAndCreateUser,
  createOwnerWithGarage,
  findPendingInviteByEmail,
  findPendingInviteByTokenHash,
  findUserByEmail,
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

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function requestSignupOtp(raw: RequestSignupOtpInput) {
  const input = requestSignupOtpSchema.parse(raw);
  const email = normalizeEmail(input.email);

  const existing = await findUserByEmail(email);
  if (existing) {
    throw new AppError("EMAIL_IN_USE", "An account with this email already exists");
  }

  return createEmailOtp({
    email,
    purpose: "signup",
    payload: {
      name: input.name.trim(),
      garageName: input.garageName.trim(),
    },
  });
}

export async function requestLoginOtp(raw: RequestLoginOtpInput) {
  const input = requestLoginOtpSchema.parse(raw);
  const email = normalizeEmail(input.email);

  const existing = await findUserByEmail(email);
  if (!existing) {
    const invite = await findPendingInviteByEmail(email);
    if (!invite) {
      // Avoid account enumeration.
      return { email, expiresInSeconds: 600 };
    }
    return createEmailOtp({
      email,
      purpose: "invite",
      payload: { name: email.split("@")[0] ?? "Team member" },
    });
  }

  return createEmailOtp({ email, purpose: "login" });
}

export async function requestInviteOtp(raw: RequestInviteOtpInput) {
  const input = requestInviteOtpSchema.parse(raw);
  const invite = await findPendingInviteByTokenHash(hashToken(input.token));
  if (!invite) {
    throw new AppError("INVALID_INVITE", "Invite is invalid or expired", 404);
  }

  const existing = await findUserByEmail(invite.email);
  if (existing) {
    throw new AppError("EMAIL_IN_USE", "An account with this email already exists");
  }

  return createEmailOtp({
    email: invite.email,
    purpose: "invite",
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
      throw new AppError("INVALID_OTP", "Signup details missing", 400);
    }

    const existing = await findUserByEmail(email);
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
      throw new AppError("INVALID_INVITE", "Invite is invalid or expired", 404);
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      return existing;
    }

    const name =
      otp.payload?.name?.trim() ||
      email.split("@")[0] ||
      "Team member";

    return acceptInviteAndCreateUser({
      inviteId: invite.id,
      email,
      name,
      role: invite.role,
      garageId: invite.garageId,
    });
  }

  const user = await findUserByEmail(email);
  if (!user) {
    throw new AppError("USER_NOT_FOUND", "Account not found", 404);
  }
  return user;
}

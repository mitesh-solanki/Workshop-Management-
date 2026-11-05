"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { auth, signIn, signOut } from "@/lib/auth";
import { authCopy } from "@/lib/auth-copy";
import { getClientIp } from "@/lib/client-ip";
import { homePathForRole } from "@/lib/rbac";
import {
  translateAuthError,
  translateAuthErrorInfo,
} from "@/lib/translate-auth-error";
import { AppError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import {
  translateError,
  translateZodFieldErrors,
} from "@/lib/translate-error";
import {
  acceptInviteWithPassword,
  changeOwnName,
  changeOwnPassword,
  requestLoginOtp,
  requestPasswordReset,
  resetPasswordWithToken,
  signupOwnerWithPassword,
} from "@/modules/auth/service";
import { getTranslations } from "next-intl/server";
import { ZodError } from "zod";

async function redirectAfterLogin(): Promise<never> {
  const session = await auth();
  const role = session?.user?.role;
  redirect(role ? homePathForRole(role) : "/dashboard");
}

export type AuthActionState = {
  ok: boolean;
  message?: string;
  field?:
    | "email"
    | "password"
    | "confirmPassword"
    | "currentPassword"
    | "name"
    | "code"
    | "garageName";
  step?: "email" | "otp" | "password" | "done";
  email?: string;
  resetUrl?: string | null;
  fieldErrors?: Record<string, string>;
};

export async function signupWithPasswordAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  try {
    await signupOwnerWithPassword({
      name: String(formData.get("name") ?? ""),
      email,
      garageName: String(formData.get("garageName") ?? ""),
      password,
      confirmPassword: String(formData.get("confirmPassword") ?? ""),
    });
    await signIn("password", {
      email,
      password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        ok: false,
        step: "password",
        field: "password",
        message: authCopy("errors.invalidCredentials"),
      };
    }
    const info = translateAuthErrorInfo(error);
    return {
      ok: false,
      step: "password",
      field: info.field ?? "password",
      message: info.message,
    };
  }

  return redirectAfterLogin();
}

/** @deprecated OTP signup — prefer signupWithPasswordAction */
export async function signupRequestOtpAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  return signupWithPasswordAction(_prev, formData);
}

export async function loginRequestOtpAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  try {
    const ip = await getClientIp();
    const result = await requestLoginOtp(
      {
        email: String(formData.get("email") ?? ""),
      },
      { locale: "en", ip },
    );
    return { ok: true, step: "otp", email: result.email };
  } catch (error) {
    return {
      ok: false,
      step: "email",
      message: translateAuthError(error),
    };
  }
}

export async function acceptInvitePasswordAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  try {
    const user = await acceptInviteWithPassword({
      token: String(formData.get("token") ?? ""),
      name: String(formData.get("name") ?? ""),
      password,
      confirmPassword: String(formData.get("confirmPassword") ?? ""),
    });
    await signIn("password", {
      email: user.email,
      password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        ok: false,
        step: "password",
        email,
        field: "password",
        message: authCopy("errors.invalidCredentials"),
      };
    }
    const info = translateAuthErrorInfo(error);
    return {
      ok: false,
      step: "password",
      email,
      field: info.field ?? "password",
      message: info.message,
    };
  }

  return redirectAfterLogin();
}

export async function verifyOtpAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "");
  const code = String(formData.get("code") ?? "");

  try {
    await signIn("email-otp", {
      email,
      code,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        ok: false,
        step: "otp",
        email,
        message: authCopy("errors.invalidOtp"),
      };
    }
    return {
      ok: false,
      step: "otp",
      email,
      message: translateAuthError(error),
    };
  }

  return redirectAfterLogin();
}

export async function loginWithPasswordAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const ip = await getClientIp();

  try {
    await signIn("password", {
      email,
      password,
      ip,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        ok: false,
        step: "password",
        email,
        field: "password",
        message: authCopy("errors.invalidCredentials"),
      };
    }
    const info = translateAuthErrorInfo(error);
    return {
      ok: false,
      step: "password",
      email,
      field: info.field ?? "password",
      message: info.message,
    };
  }

  return redirectAfterLogin();
}

export async function forgotPasswordAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  try {
    const ip = await getClientIp();
    const result = await requestPasswordReset(
      { email: String(formData.get("email") ?? "") },
      { locale: "en", ip },
    );
    return {
      ok: true,
      step: "done",
      email: result.email,
      resetUrl: result.resetUrl,
      message: result.emailSent
        ? authCopy("forgotSent")
        : authCopy("forgotLinkReady"),
    };
  } catch (error) {
    return {
      ok: false,
      step: "email",
      message: translateAuthError(error),
    };
  }
}

export async function resetPasswordAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  try {
    const result = await resetPasswordWithToken({
      token: String(formData.get("token") ?? ""),
      password: String(formData.get("password") ?? ""),
      confirmPassword: String(formData.get("confirmPassword") ?? ""),
    });
    await signIn("password", {
      email: result.email,
      password: String(formData.get("password") ?? ""),
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        ok: false,
        step: "password",
        field: "password",
        message: authCopy("errors.invalidCredentials"),
      };
    }
    const info = translateAuthErrorInfo(error);
    return {
      ok: false,
      step: "password",
      field: info.field ?? "password",
      message: info.message,
    };
  }

  return redirectAfterLogin();
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

export async function changeOwnPasswordAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const t = await getTranslations("auth");

  try {
    const session = await requireSession();
    await changeOwnPassword(session, {
      currentPassword: String(formData.get("currentPassword") ?? ""),
      password: String(formData.get("password") ?? ""),
      confirmPassword: String(formData.get("confirmPassword") ?? ""),
    });
    return { ok: true, message: t("passwordChanged") };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        ok: false,
        message: await translateError(error),
        fieldErrors: await translateZodFieldErrors(error),
      };
    }
    if (error instanceof AppError) {
      const info = translateAuthErrorInfo(error);
      return {
        ok: false,
        message: info.message,
        field: info.field,
        fieldErrors: info.field
          ? { [info.field]: info.message }
          : undefined,
      };
    }
    return { ok: false, message: await translateError(error) };
  }
}

export async function changeOwnNameAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const t = await getTranslations("auth");

  try {
    const session = await requireSession();
    await changeOwnName(session, {
      name: String(formData.get("name") ?? ""),
    });
    return { ok: true, message: t("nameChanged") };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        ok: false,
        message: await translateError(error),
        fieldErrors: await translateZodFieldErrors(error),
      };
    }
    return { ok: false, message: await translateError(error) };
  }
}

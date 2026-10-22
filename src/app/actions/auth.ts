"use server";

import { AuthError } from "next-auth";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/lib/auth";
import { getClientIp } from "@/lib/client-ip";
import { translateError } from "@/lib/translate-error";
import {
  requestInviteOtp,
  requestLoginOtp,
  requestSignupOtp,
} from "@/modules/auth/service";

export type AuthActionState = {
  ok: boolean;
  message?: string;
  step?: "email" | "otp";
  email?: string;
};

export async function signupRequestOtpAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  try {
    const locale = await getLocale();
    const ip = await getClientIp();
    const result = await requestSignupOtp(
      {
        name: String(formData.get("name") ?? ""),
        email: String(formData.get("email") ?? ""),
        garageName: String(formData.get("garageName") ?? ""),
      },
      { locale, ip },
    );
    return { ok: true, step: "otp", email: result.email };
  } catch (error) {
    return { ok: false, step: "email", message: await translateError(error) };
  }
}

export async function loginRequestOtpAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  try {
    const locale = await getLocale();
    const ip = await getClientIp();
    const result = await requestLoginOtp(
      {
        email: String(formData.get("email") ?? ""),
      },
      { locale, ip },
    );
    return { ok: true, step: "otp", email: result.email };
  } catch (error) {
    return { ok: false, step: "email", message: await translateError(error) };
  }
}

export async function inviteRequestOtpAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  try {
    const locale = await getLocale();
    const ip = await getClientIp();
    const result = await requestInviteOtp(
      {
        token: String(formData.get("token") ?? ""),
        name: String(formData.get("name") ?? ""),
      },
      { locale, ip },
    );
    return { ok: true, step: "otp", email: result.email };
  } catch (error) {
    return { ok: false, step: "email", message: await translateError(error) };
  }
}

export async function verifyOtpAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "");
  const code = String(formData.get("code") ?? "");
  const t = await getTranslations("auth");

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
        message: t("errors.invalidOtp"),
      };
    }
    return {
      ok: false,
      step: "otp",
      email,
      message: await translateError(error),
    };
  }

  redirect("/dashboard");
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

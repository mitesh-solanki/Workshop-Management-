"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/lib/auth";
import { AppError } from "@/lib/errors";
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

function toMessage(error: unknown) {
  if (error instanceof AppError) {
    return error.message;
  }
  return "Something went wrong";
}

export async function signupRequestOtpAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  try {
    const result = await requestSignupOtp({
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      garageName: String(formData.get("garageName") ?? ""),
    });
    return { ok: true, step: "otp", email: result.email };
  } catch (error) {
    return { ok: false, step: "email", message: toMessage(error) };
  }
}

export async function loginRequestOtpAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  try {
    const result = await requestLoginOtp({
      email: String(formData.get("email") ?? ""),
    });
    return { ok: true, step: "otp", email: result.email };
  } catch (error) {
    return { ok: false, step: "email", message: toMessage(error) };
  }
}

export async function inviteRequestOtpAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  try {
    const result = await requestInviteOtp({
      token: String(formData.get("token") ?? ""),
      name: String(formData.get("name") ?? ""),
    });
    return { ok: true, step: "otp", email: result.email };
  } catch (error) {
    return { ok: false, step: "email", message: toMessage(error) };
  }
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
        message: "Invalid or expired code",
      };
    }
    return { ok: false, step: "otp", email, message: toMessage(error) };
  }

  redirect("/dashboard");
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

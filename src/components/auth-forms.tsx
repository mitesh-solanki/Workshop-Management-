"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import {
  inviteRequestOtpAction,
  loginRequestOtpAction,
  signupRequestOtpAction,
  verifyOtpAction,
  type AuthActionState,
} from "@/app/actions/auth";

const initial: AuthActionState = { ok: false, step: "email" };

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  "min-h-12 w-full rounded-md border bg-background px-3 text-base outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring";

function OtpStep({
  email,
  action,
  message,
}: {
  email: string;
  action: typeof verifyOtpAction;
  message?: string;
}) {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState(action, {
    ok: false,
    step: "otp",
    email,
  });

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="email" value={email} />
      <p className="text-sm text-muted-foreground">{t("otpSent", { email })}</p>
      <Field id="code" label={t("code")}>
        <input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          className={inputClass}
        />
      </Field>
      {(state.message || message) && (
        <p className="text-sm text-destructive" role="alert">
          {state.message ?? message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 rounded-md bg-primary px-4 text-base font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending ? t("verifying") : t("verify")}
      </button>
    </form>
  );
}

export function SignupForm() {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState(
    signupRequestOtpAction,
    initial,
  );

  if (state.step === "otp" && state.email) {
    return <OtpStep email={state.email} action={verifyOtpAction} />;
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field id="name" label={t("name")}>
        <input id="name" name="name" required className={inputClass} />
      </Field>
      <Field id="email" label={t("email")}>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className={inputClass}
        />
      </Field>
      <Field id="garageName" label={t("garageName")}>
        <input id="garageName" name="garageName" required className={inputClass} />
      </Field>
      {state.message && (
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 rounded-md bg-primary px-4 text-base font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending ? t("sendingCode") : t("continue")}
      </button>
    </form>
  );
}

export function LoginForm() {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState(
    loginRequestOtpAction,
    initial,
  );

  if (state.step === "otp" && state.email) {
    return <OtpStep email={state.email} action={verifyOtpAction} />;
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field id="email" label={t("email")}>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className={inputClass}
        />
      </Field>
      {state.message && (
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 rounded-md bg-primary px-4 text-base font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending ? t("sendingCode") : t("continue")}
      </button>
    </form>
  );
}

export function InviteAcceptForm({
  token,
  email,
}: {
  token: string;
  email: string;
}) {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState(
    inviteRequestOtpAction,
    initial,
  );

  if (state.step === "otp" && state.email) {
    return <OtpStep email={state.email} action={verifyOtpAction} />;
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <p className="text-sm text-muted-foreground">{t("inviteFor", { email })}</p>
      <Field id="name" label={t("name")}>
        <input id="name" name="name" required className={inputClass} />
      </Field>
      {state.message && (
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 rounded-md bg-primary px-4 text-base font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending ? t("sendingCode") : t("continue")}
      </button>
    </form>
  );
}

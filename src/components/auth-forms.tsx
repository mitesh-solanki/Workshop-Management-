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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: AuthActionState = { ok: false, step: "email" };

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function OtpStep({
  email,
  action,
}: {
  email: string;
  action: typeof verifyOtpAction;
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
      <Field id="code" label={t("code")} error={state.message}>
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          aria-invalid={Boolean(state.message)}
        />
      </Field>
      <Button type="submit" disabled={pending} size="lg" className="w-full">
        {pending ? t("verifying") : t("verify")}
      </Button>
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
        <Input id="name" name="name" required />
      </Field>
      <Field id="email" label={t("email")}>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
        />
      </Field>
      <Field id="garageName" label={t("garageName")} error={state.message}>
        <Input id="garageName" name="garageName" required />
      </Field>
      <Button type="submit" disabled={pending} size="lg" className="w-full">
        {pending ? t("sendingCode") : t("continue")}
      </Button>
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
      <Field id="email" label={t("email")} error={state.message}>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
        />
      </Field>
      <Button type="submit" disabled={pending} size="lg" className="w-full">
        {pending ? t("sendingCode") : t("continue")}
      </Button>
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
      <Field id="name" label={t("name")} error={state.message}>
        <Input id="name" name="name" required />
      </Field>
      <Button type="submit" disabled={pending} size="lg" className="w-full">
        {pending ? t("sendingCode") : t("continue")}
      </Button>
    </form>
  );
}

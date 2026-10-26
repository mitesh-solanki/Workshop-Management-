"use client";

import { useActionState, useState } from "react";
import {
  inviteRequestOtpAction,
  loginRequestOtpAction,
  loginWithPasswordAction,
  signupRequestOtpAction,
  verifyOtpAction,
  type AuthActionState,
} from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authCopy } from "@/lib/auth-copy";

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
  const [state, formAction, pending] = useActionState(action, {
    ok: false,
    step: "otp",
    email,
  });

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="email" value={email} />
      <p className="text-sm text-muted-foreground">
        {authCopy("otpSent", { email })}
      </p>
      <Field id="code" label={authCopy("code")} error={state.message}>
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          aria-invalid={Boolean(state.message)}
          className="h-11 min-h-11"
        />
      </Field>
      <Button type="submit" disabled={pending} size="lg" className="w-full">
        {pending ? authCopy("verifying") : authCopy("verify")}
      </Button>
    </form>
  );
}

export function SignupForm() {
  const [state, formAction, pending] = useActionState(
    signupRequestOtpAction,
    initial,
  );

  if (state.step === "otp" && state.email) {
    return <OtpStep email={state.email} action={verifyOtpAction} />;
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field id="name" label={authCopy("name")}>
        <Input id="name" name="name" required className="h-11 min-h-11" />
      </Field>
      <Field id="email" label={authCopy("email")}>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="h-11 min-h-11"
        />
      </Field>
      <Field id="garageName" label={authCopy("garageName")} error={state.message}>
        <Input
          id="garageName"
          name="garageName"
          required
          className="h-11 min-h-11"
        />
      </Field>
      <Button type="submit" disabled={pending} size="lg" className="w-full">
        {pending ? authCopy("sendingCode") : authCopy("continue")}
      </Button>
    </form>
  );
}

function PasswordLoginForm() {
  const [state, formAction, pending] = useActionState(
    loginWithPasswordAction,
    { ok: false, step: "password" as const },
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field id="email" label={authCopy("email")}>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={state.email}
          className="h-11 min-h-11"
        />
      </Field>
      <Field
        id="password"
        label={authCopy("password")}
        error={state.message}
      >
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="h-11 min-h-11"
        />
      </Field>
      <Button type="submit" disabled={pending} size="lg" className="w-full">
        {pending ? authCopy("signingIn") : authCopy("signIn")}
      </Button>
    </form>
  );
}

function OtpLoginForm() {
  const [state, formAction, pending] = useActionState(
    loginRequestOtpAction,
    initial,
  );

  if (state.step === "otp" && state.email) {
    return <OtpStep email={state.email} action={verifyOtpAction} />;
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field id="email" label={authCopy("email")} error={state.message}>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="h-11 min-h-11"
        />
      </Field>
      <Button type="submit" disabled={pending} size="lg" className="w-full">
        {pending ? authCopy("sendingCode") : authCopy("continue")}
      </Button>
    </form>
  );
}

export function LoginForm({
  passwordLoginEnabled = false,
}: {
  passwordLoginEnabled?: boolean;
}) {
  const [mode, setMode] = useState<"password" | "otp">(
    passwordLoginEnabled ? "password" : "otp",
  );

  if (!passwordLoginEnabled) {
    return <OtpLoginForm />;
  }

  return (
    <div className="flex flex-col gap-4">
      {mode === "password" ? <PasswordLoginForm /> : <OtpLoginForm />}
      <button
        type="button"
        className="min-h-11 text-sm font-medium text-foreground underline underline-offset-4"
        onClick={() => setMode(mode === "password" ? "otp" : "password")}
      >
        {mode === "password"
          ? authCopy("useOtpInstead")
          : authCopy("usePasswordInstead")}
      </button>
    </div>
  );
}

export function InviteAcceptForm({
  token,
  email,
}: {
  token: string;
  email: string;
}) {
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
      <p className="text-sm text-muted-foreground">
        {authCopy("inviteFor", { email })}
      </p>
      <Field id="name" label={authCopy("name")} error={state.message}>
        <Input id="name" name="name" required className="h-11 min-h-11" />
      </Field>
      <Button type="submit" disabled={pending} size="lg" className="w-full">
        {pending ? authCopy("sendingCode") : authCopy("continue")}
      </Button>
    </form>
  );
}

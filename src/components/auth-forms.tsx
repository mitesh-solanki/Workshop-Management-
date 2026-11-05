"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  acceptInvitePasswordAction,
  forgotPasswordAction,
  loginRequestOtpAction,
  loginWithPasswordAction,
  resetPasswordAction,
  signupWithPasswordAction,
  verifyOtpAction,
  type AuthActionState,
} from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { authCopy } from "@/lib/auth-copy";

const initial: AuthActionState = { ok: false, step: "email" };

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function fieldError(
  state: AuthActionState,
  field: NonNullable<AuthActionState["field"]>,
) {
  return state.field === field ? state.message : undefined;
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
          type="password"
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
    signupWithPasswordAction,
    { ok: false, step: "password" as const },
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field id="name" label={authCopy("name")} error={fieldError(state, "name")}>
        <Input id="name" name="name" required className="h-11 min-h-11" />
      </Field>
      <Field
        id="email"
        label={authCopy("email")}
        error={fieldError(state, "email")}
      >
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="h-11 min-h-11"
        />
      </Field>
      <Field
        id="garageName"
        label={authCopy("garageName")}
        error={fieldError(state, "garageName")}
      >
        <Input
          id="garageName"
          name="garageName"
          required
          className="h-11 min-h-11"
        />
      </Field>
      <Field
        id="password"
        label={authCopy("password")}
        hint={authCopy("passwordHint")}
        error={fieldError(state, "password") ?? (!state.field ? state.message : undefined)}
      >
        <PasswordInput
          id="password"
          name="password"
          required
          autoComplete="new-password"
          aria-invalid={Boolean(fieldError(state, "password") || (!state.field && state.message))}
        />
      </Field>
      <Field
        id="confirmPassword"
        label={authCopy("confirmPassword")}
        error={fieldError(state, "confirmPassword")}
      >
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          required
          autoComplete="new-password"
          aria-invalid={Boolean(fieldError(state, "confirmPassword"))}
        />
      </Field>
      <Button type="submit" disabled={pending} size="lg" className="w-full">
        {pending ? authCopy("signingIn") : authCopy("createWorkspace")}
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
        <PasswordInput
          id="password"
          name="password"
          required
          autoComplete="current-password"
          aria-invalid={Boolean(state.message)}
        />
      </Field>
      <Button type="submit" disabled={pending} size="lg" className="w-full">
        {pending ? authCopy("signingIn") : authCopy("signIn")}
      </Button>
      <p className="text-center text-sm">
        <Link
          href="/forgot-password"
          className="font-medium text-foreground underline underline-offset-4"
        >
          {authCopy("forgotPasswordLink")}
        </Link>
      </p>
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
  otpLoginEnabled = false,
}: {
  otpLoginEnabled?: boolean;
}) {
  const [mode, setMode] = useState<"password" | "otp">("password");

  if (!otpLoginEnabled) {
    return <PasswordLoginForm />;
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
    acceptInvitePasswordAction,
    { ok: false, step: "password" as const, email },
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="email" value={email} />
      <p className="text-sm text-muted-foreground">
        {authCopy("inviteFor", { email })}
      </p>
      <Field id="name" label={authCopy("name")} error={fieldError(state, "name")}>
        <Input id="name" name="name" required className="h-11 min-h-11" />
      </Field>
      <Field
        id="password"
        label={authCopy("password")}
        hint={authCopy("passwordHint")}
        error={
          fieldError(state, "password") ??
          (!state.field ? state.message : undefined)
        }
      >
        <PasswordInput
          id="password"
          name="password"
          required
          autoComplete="new-password"
          aria-invalid={Boolean(
            fieldError(state, "password") || (!state.field && state.message),
          )}
        />
      </Field>
      <Field
        id="confirmPassword"
        label={authCopy("confirmPassword")}
        error={fieldError(state, "confirmPassword")}
      >
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          required
          autoComplete="new-password"
          aria-invalid={Boolean(fieldError(state, "confirmPassword"))}
        />
      </Field>
      <Button type="submit" disabled={pending} size="lg" className="w-full">
        {pending ? authCopy("signingIn") : authCopy("joinTeam")}
      </Button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    forgotPasswordAction,
    initial,
  );

  if (state.step === "done") {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{state.message}</p>
        {state.resetUrl ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 text-xs font-medium text-slate-500">
              {authCopy("resetLinkLabel")}
            </p>
            <a
              href={state.resetUrl}
              className="break-all text-sm font-medium text-blue-700 underline underline-offset-4"
            >
              {state.resetUrl}
            </a>
          </div>
        ) : null}
        <Link
          href="/login"
          className="text-center text-sm font-medium underline underline-offset-4"
        >
          {authCopy("loginLink")}
        </Link>
      </div>
    );
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
        {pending ? authCopy("sendingReset") : authCopy("sendResetLink")}
      </Button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(
    resetPasswordAction,
    { ok: false, step: "password" as const },
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <Field
        id="password"
        label={authCopy("password")}
        hint={authCopy("passwordHint")}
        error={
          fieldError(state, "password") ??
          (!state.field ? state.message : undefined)
        }
      >
        <PasswordInput
          id="password"
          name="password"
          required
          autoComplete="new-password"
          aria-invalid={Boolean(
            fieldError(state, "password") || (!state.field && state.message),
          )}
        />
      </Field>
      <Field
        id="confirmPassword"
        label={authCopy("confirmPassword")}
        error={fieldError(state, "confirmPassword")}
      >
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          required
          autoComplete="new-password"
          aria-invalid={Boolean(fieldError(state, "confirmPassword"))}
        />
      </Field>
      <Button type="submit" disabled={pending} size="lg" className="w-full">
        {pending ? authCopy("signingIn") : authCopy("savePassword")}
      </Button>
    </form>
  );
}

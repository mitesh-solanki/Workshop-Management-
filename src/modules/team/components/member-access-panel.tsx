"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Ban, CheckCircle2, KeyRound, Link, Mail } from "lucide-react";
import {
  sendMemberPasswordResetAction,
  setMemberActiveAction,
  setMemberPasswordAction,
  type TeamActionState,
} from "@/app/actions/team";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { PasswordInput } from "@/components/ui/password-input";
import { toast } from "@/components/ui/toast";
import { passwordPolicyErrorKey } from "@/lib/password";

type Props = {
  member: {
    id: string;
    name: string | null;
    email: string;
    isActive: boolean;
    hasPassword: boolean;
  };
  canManageAccess: boolean;
  /** Owner on their own member page — password actions only. */
  canManageOwnPassword?: boolean;
};

const initial: TeamActionState = { ok: false };

export function MemberAccessPanel({
  member,
  canManageAccess,
  canManageOwnPassword = false,
}: Props) {
  const t = useTranslations("team");
  const ta = useTranslations("auth");
  const te = useTranslations("errors");
  const router = useRouter();
  const formId = useId();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<
    "disable" | "enable" | "password" | "reset" | null
  >(null);
  const [disableOpen, setDisableOpen] = useState(false);
  const [enableOpen, setEnableOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [resetUrl, setResetUrl] = useState<string | null>(null);

  function handlePasswordOpenChange(next: boolean) {
    setPasswordOpen(next);
    if (!next) {
      setPassword("");
      setConfirmPassword("");
      setFieldErrors({});
    }
  }

  const canEditPassword = canManageAccess || canManageOwnPassword;

  if (!canEditPassword) {
    return (
      <div className="space-y-3 px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={member.isActive ? "success" : "danger"}>
            {member.isActive ? t("statusActive") : t("statusDisabled")}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {member.hasPassword
              ? t("accessHasPassword")
              : t("accessNoPassword")}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{t("accessReadOnly")}</p>
      </div>
    );
  }

  function validatePassword(): boolean {
    const next: Record<string, string> = {};
    if (!password.trim()) {
      next.password = te("validation.required");
    } else {
      const policyKey = passwordPolicyErrorKey(password);
      if (policyKey) {
        next.password = te(policyKey as "validation.passwordTooShort");
      }
    }
    if (!confirmPassword.trim()) {
      next.confirmPassword = te("validation.required");
    } else if (password !== confirmPassword) {
      next.confirmPassword = te("validation.passwordMismatch");
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  function clearFieldError(field: "password" | "confirmPassword") {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function onToggleActive(nextActive: boolean) {
    setBusy(nextActive ? "enable" : "disable");
    startTransition(async () => {
      const result = await setMemberActiveAction(member.id, nextActive);
      setBusy(null);
      if (!result.ok) {
        toast.error(result.message ?? t("error"));
        return;
      }
      toast.success(result.message ?? t("memberUpdated"));
      setDisableOpen(false);
      setEnableOpen(false);
      router.refresh();
    });
  }

  function onSavePassword(formData: FormData) {
    if (!validatePassword()) return;
    setBusy("password");
    startTransition(async () => {
      const result = await setMemberPasswordAction(initial, formData);
      setBusy(null);
      if (!result.ok) {
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        } else {
          toast.error(result.message ?? t("error"));
        }
        return;
      }
      toast.success(result.message ?? t("passwordUpdated"));
      setPasswordOpen(false);
      router.refresh();
    });
  }

  function onSendReset() {
    setBusy("reset");
    startTransition(async () => {
      const result = await sendMemberPasswordResetAction(member.id);
      setBusy(null);
      if (!result.ok) {
        toast.error(result.message ?? t("error"));
        return;
      }
      toast.success(result.message ?? t("passwordResetSent"));
      setResetUrl(result.resetUrl ?? null);
      router.refresh();
    });
  }

  async function copyResetLink() {
    if (!resetUrl) return;
    try {
      await navigator.clipboard.writeText(resetUrl);
      toast.success(t("passwordResetLinkCopied"));
    } catch {
      toast.error(t("inviteLinkCopyFailed"));
    }
  }

  return (
    <div className="space-y-5 px-5 py-5 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={member.isActive ? "success" : "danger"}>
          {member.isActive ? t("statusActive") : t("statusDisabled")}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {member.hasPassword ? t("accessHasPassword") : t("accessNoPassword")}
        </span>
      </div>

      {canManageOwnPassword && !canManageAccess ? (
        <p className="text-sm text-muted-foreground">{t("accessOwnHint")}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {canManageAccess ? (
          member.isActive ? (
            <ConfirmDialog
              open={disableOpen}
              onOpenChange={(open) => {
                if (!pending) setDisableOpen(open);
              }}
              title={t("disableTitle")}
              description={t("disableConfirm", {
                name: member.name?.trim() || member.email,
              })}
              confirmLabel={t("disableAccess")}
              variant="danger"
              loading={busy === "disable"}
              onConfirm={() => onToggleActive(false)}
              trigger={
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 min-h-11 justify-start gap-2"
                  disabled={pending}
                >
                  <Ban className="size-4" aria-hidden />
                  {t("disableAccess")}
                </Button>
              }
            />
          ) : (
            <ConfirmDialog
              open={enableOpen}
              onOpenChange={(open) => {
                if (!pending) setEnableOpen(open);
              }}
              title={t("enableTitle")}
              description={t("enableConfirm", {
                name: member.name?.trim() || member.email,
              })}
              confirmLabel={t("enableAccess")}
              loading={busy === "enable"}
              onConfirm={() => onToggleActive(true)}
              trigger={
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 min-h-11 justify-start gap-2"
                  disabled={pending}
                >
                  <CheckCircle2 className="size-4" aria-hidden />
                  {t("enableAccess")}
                </Button>
              }
            />
          )
        ) : null}

        <Dialog open={passwordOpen} onOpenChange={handlePasswordOpenChange}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="h-11 min-h-11 justify-start gap-2"
              disabled={pending || !member.isActive}
            >
              <KeyRound className="size-4" aria-hidden />
              {member.hasPassword ? t("updatePassword") : t("setPassword")}
            </Button>
          </DialogTrigger>
          <DialogContent className="gap-0 p-0 sm:max-w-md">
            <DialogHeader className="border-b border-border px-5 py-4 pr-12 text-left">
              <DialogTitle>
                {member.hasPassword
                  ? t("updatePasswordTitle")
                  : t("setPasswordTitle")}
              </DialogTitle>
              <DialogDescription>
                {member.hasPassword
                  ? canManageOwnPassword && !canManageAccess
                    ? t("updateOwnPasswordDescription")
                    : t("updatePasswordDescription")
                  : t("setPasswordDescription")}
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="px-5 py-4">
              <form
                id={formId}
                className="flex flex-col gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  onSavePassword(new FormData(event.currentTarget));
                }}
              >
                <input type="hidden" name="userId" value={member.id} />
                <FormField
                  id={`${formId}-password`}
                  label={t("password")}
                  error={fieldErrors.password}
                >
                  <PasswordInput
                    id={`${formId}-password`}
                    name="password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      clearFieldError("password");
                    }}
                    autoComplete="new-password"
                    className="h-11 min-h-11"
                    aria-invalid={Boolean(fieldErrors.password)}
                  />
                </FormField>
                <FormField
                  id={`${formId}-confirm`}
                  label={t("confirmPassword")}
                  error={fieldErrors.confirmPassword}
                >
                  <PasswordInput
                    id={`${formId}-confirm`}
                    name="confirmPassword"
                    value={confirmPassword}
                    onChange={(event) => {
                      setConfirmPassword(event.target.value);
                      clearFieldError("confirmPassword");
                    }}
                    autoComplete="new-password"
                    className="h-11 min-h-11"
                    aria-invalid={Boolean(fieldErrors.confirmPassword)}
                  />
                </FormField>
                <p className="text-xs text-muted-foreground">
                  {ta("passwordHint")}
                </p>
              </form>
            </DialogBody>
            <DialogFooter className="gap-2 border-t border-border bg-background px-5 py-4 sm:justify-end">
              <DialogClose asChild>
                <Button type="button" variant="secondary" size="md">
                  {t("close")}
                </Button>
              </DialogClose>
              <Button
                type="submit"
                form={formId}
                size="md"
                loading={busy === "password"}
              >
                {member.hasPassword ? t("updatePassword") : t("setPassword")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {member.hasPassword && member.isActive ? (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3.5">
          <p className="text-sm font-semibold text-foreground">
            {t("sendPasswordReset")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {canManageOwnPassword && !canManageAccess
              ? t("sendOwnPasswordResetDescription")
              : t("sendPasswordResetDescription")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 min-h-11 gap-2"
              disabled={pending}
              loading={busy === "reset"}
              onClick={onSendReset}
            >
              <Mail className="size-4" aria-hidden />
              {t("sendPasswordReset")}
            </Button>
            {resetUrl ? (
              <Button
                type="button"
                variant="secondary"
                className="h-11 min-h-11 gap-2"
                onClick={() => void copyResetLink()}
              >
                <Link className="size-4" aria-hidden />
                {t("copyResetLink")}
              </Button>
            ) : null}
          </div>
          {resetUrl ? (
            <p className="mt-2 break-all text-xs text-muted-foreground">
              {resetUrl}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  changeOwnNameAction,
  changeOwnPasswordAction,
  type AuthActionState,
} from "@/app/actions/auth";
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
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { toast } from "@/components/ui/toast";
import { passwordPolicyErrorKey } from "@/lib/password";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentName: string;
};

const initial: AuthActionState = { ok: false };

export function AccountSettingsDialog({
  open,
  onOpenChange,
  currentName,
}: Props) {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const router = useRouter();
  const formId = useId();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(currentName);
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function resetPasswordFields() {
    setCurrentPassword("");
    setPassword("");
    setConfirmPassword("");
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (next) {
      setName(currentName);
      resetPasswordFields();
      setFieldErrors({});
    } else {
      resetPasswordFields();
      setFieldErrors({});
    }
  }

  function clearFieldError(field: string) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function validate(wantsPassword: boolean): boolean {
    const next: Record<string, string> = {};
    const trimmed = name.trim();
    if (!trimmed) {
      next.name = te("validation.required");
    } else if (trimmed.length < 2) {
      next.name = te("validation.tooShort");
    } else if (trimmed.length > 80) {
      next.name = te("validation.tooLong");
    }

    if (wantsPassword) {
      if (!currentPassword.trim()) {
        next.currentPassword = te("validation.required");
      }
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
    }

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  function onSubmit(formData: FormData) {
    const wantsPassword = Boolean(
      String(formData.get("currentPassword") ?? "").trim() ||
        String(formData.get("password") ?? "").trim() ||
        String(formData.get("confirmPassword") ?? "").trim(),
    );
    const nameChanged = name.trim() !== currentName.trim();

    if (!nameChanged && !wantsPassword) {
      handleOpenChange(false);
      return;
    }

    if (!validate(wantsPassword)) return;

    startTransition(async () => {
      const errors: Record<string, string> = {};
      let nameOk = !nameChanged;
      let passwordOk = !wantsPassword;

      if (nameChanged) {
        const nameResult = await changeOwnNameAction(initial, formData);
        if (!nameResult.ok) {
          if (nameResult.fieldErrors) {
            Object.assign(errors, nameResult.fieldErrors);
          } else {
            toast.error(nameResult.message ?? tc("error"));
            return;
          }
        } else {
          nameOk = true;
        }
      }

      if (wantsPassword) {
        const passwordResult = await changeOwnPasswordAction(initial, formData);
        if (!passwordResult.ok) {
          if (passwordResult.fieldErrors) {
            Object.assign(errors, passwordResult.fieldErrors);
          } else if (passwordResult.field && passwordResult.message) {
            errors[passwordResult.field] = passwordResult.message;
          } else {
            toast.error(passwordResult.message ?? tc("error"));
            return;
          }
        } else {
          passwordOk = true;
        }
      }

      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }

      if (nameOk && passwordOk) {
        if (nameChanged && wantsPassword) {
          toast.success(t("accountUpdated"));
        } else if (nameChanged) {
          toast.success(t("nameChanged"));
        } else {
          toast.success(t("passwordChanged"));
        }
        handleOpenChange(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border px-5 py-4 pr-12 text-left">
          <DialogTitle>{t("accountSettingsTitle")}</DialogTitle>
          <DialogDescription>
            {t("accountSettingsDescription")}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="px-5 py-4">
          <form
            id={formId}
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit(new FormData(event.currentTarget));
            }}
          >
            <FormField
              id={`${formId}-name`}
              label={t("name")}
              error={fieldErrors.name}
            >
              <Input
                id={`${formId}-name`}
                name="name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  clearFieldError("name");
                }}
                autoComplete="name"
                className="h-11 min-h-11"
                aria-invalid={Boolean(fieldErrors.name)}
              />
            </FormField>

            <div className="border-t border-border" />

            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                {t("changePasswordTitle")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("accountPasswordOptionalHint")}
              </p>
            </div>

            <FormField
              id={`${formId}-current`}
              label={t("currentPassword")}
              error={fieldErrors.currentPassword}
            >
              <PasswordInput
                id={`${formId}-current`}
                name="currentPassword"
                value={currentPassword}
                onChange={(event) => {
                  setCurrentPassword(event.target.value);
                  clearFieldError("currentPassword");
                }}
                autoComplete="current-password"
                className="h-11 min-h-11"
                aria-invalid={Boolean(fieldErrors.currentPassword)}
              />
            </FormField>
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
            <p className="text-xs text-muted-foreground">{t("passwordHint")}</p>
          </form>
        </DialogBody>
        <DialogFooter className="gap-2 border-t border-border bg-background px-5 py-4 sm:justify-end">
          <DialogClose asChild>
            <Button type="button" variant="secondary" size="md">
              {tc("cancel")}
            </Button>
          </DialogClose>
          <Button type="submit" form={formId} size="md" loading={pending}>
            {t("saveAccount")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

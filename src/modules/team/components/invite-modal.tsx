"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { UserPlus } from "lucide-react";
import {
  inviteTeamMemberAction,
  type TeamActionState,
} from "@/app/actions/team";
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
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { isValidEmail, sanitizeEmailTyping } from "@/lib/contact";
import { cn } from "@/lib/utils";

const initial: TeamActionState = { ok: false };

const INVITE_ROLES = ["MANAGER", "TECHNICIAN", "ACCOUNTANT"] as const;

type InviteRole = (typeof INVITE_ROLES)[number];

export function InviteModal() {
  const t = useTranslations("team");
  const te = useTranslations("errors");
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<InviteRole>("MANAGER");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>();
  const [state, formAction, pending] = useActionState(
    inviteTeamMemberAction,
    initial,
  );
  const handledMessage = useRef<string | null>(null);

  useEffect(() => {
    if (!state.message || state.message === handledMessage.current) return;
    handledMessage.current = state.message;

    if (state.ok) {
      toast.success(state.message);
      const id = window.setTimeout(() => {
        setOpen(false);
        setRole("MANAGER");
        setEmail("");
        setEmailError(undefined);
      }, 0);
      return () => window.clearTimeout(id);
    }

    toast.error(state.message);
  }, [state]);

  function validateClient(): boolean {
    if (!email.trim() || !isValidEmail(email)) {
      setEmailError(te("validation.invalidEmail"));
      window.setTimeout(() => {
        document.getElementById("invite-email")?.focus();
      }, 50);
      return false;
    }
    setEmailError(undefined);
    return true;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          handledMessage.current = null;
          setEmailError(undefined);
        } else {
          setEmail("");
          setEmailError(undefined);
          setRole("MANAGER");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="md">
          <UserPlus className="size-4" aria-hidden />
          {t("inviteMember")}
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogTitle>{t("inviteTitle")}</DialogTitle>
          <DialogDescription>{t("inviteDescription")}</DialogDescription>
        </DialogHeader>

        <DialogBody className="px-5 py-4">
          <form
            id={formId}
            action={(formData) => {
              if (!validateClient()) return;
              formAction(formData);
            }}
            className="flex flex-col gap-5"
          >
            <FormField
              id="invite-email"
              label={t("email")}
              error={emailError}
            >
              <Input
                id="invite-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder={t("emailPlaceholder")}
                value={email}
                onChange={(e) => {
                  setEmail(sanitizeEmailTyping(e.target.value));
                  if (emailError) setEmailError(undefined);
                }}
                aria-invalid={Boolean(emailError)}
                className="h-11 min-h-11"
              />
            </FormField>

            <div className="flex flex-col gap-2">
              <p
                className="text-sm font-medium text-slate-900"
                id="invite-role-label"
              >
                {t("role")}
              </p>
              <input type="hidden" name="role" value={role} />
              <div
                role="radiogroup"
                aria-labelledby="invite-role-label"
                className="grid grid-cols-3 gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1"
              >
                {INVITE_ROLES.map((option) => {
                  const selected = role === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setRole(option)}
                      className={cn(
                        "min-h-11 rounded-md px-2 text-caption font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600",
                        selected
                          ? "bg-card text-slate-900 shadow-sm"
                          : "text-slate-600 hover:text-slate-900",
                      )}
                    >
                      {t(`roles.${option}`)}
                    </button>
                  );
                })}
              </div>
              <p className="text-caption text-slate-500">
                {t(`roleAccess.${role}`)}
              </p>
            </div>
          </form>
        </DialogBody>
        <DialogFooter className="gap-2 border-t border-border bg-background px-5 py-4 sm:justify-stretch">
          <DialogClose asChild>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              className="w-full sm:flex-1"
            >
              {t("close")}
            </Button>
          </DialogClose>
          <Button
            type="submit"
            form={formId}
            loading={pending}
            size="lg"
            className="w-full sm:flex-1"
          >
            {pending ? t("inviting") : t("invite")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

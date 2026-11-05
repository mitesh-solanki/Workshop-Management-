"use client";

import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import {
  updateMemberAction,
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
import { cn } from "@/lib/utils";

const MEMBER_ROLES = ["MANAGER", "TECHNICIAN", "ACCOUNTANT"] as const;

type MemberRole = (typeof MEMBER_ROLES)[number];

const initial: TeamActionState = { ok: false };

type Props = {
  member: {
    id: string;
    name: string | null;
    email: string;
    role: string;
  };
  trigger?: ReactNode;
  size?: "sm" | "md";
};

export function EditMemberModal({ member, trigger, size = "md" }: Props) {
  const t = useTranslations("team");
  const router = useRouter();
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(member.name?.trim() || "");
  const [email, setEmail] = useState(member.email);
  const [selectedRole, setSelectedRole] = useState<MemberRole>(
    MEMBER_ROLES.includes(member.role as MemberRole)
      ? (member.role as MemberRole)
      : "MANAGER",
  );
  const [state, formAction, pending] = useActionState(
    updateMemberAction,
    initial,
  );
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!state.message || state.message === handled.current) return;
    handled.current = state.message;
    if (state.ok) {
      toast.success(state.message);
      const id = window.setTimeout(() => {
        setOpen(false);
        router.refresh();
      }, 0);
      return () => window.clearTimeout(id);
    }
    toast.error(state.message);
  }, [state, router]);

  function resetFromMember() {
    setName(member.name?.trim() || "");
    setEmail(member.email);
    setSelectedRole(
      MEMBER_ROLES.includes(member.role as MemberRole)
        ? (member.role as MemberRole)
        : "MANAGER",
    );
    handled.current = null;
  }

  const unchanged =
    name.trim() === (member.name?.trim() || "") &&
    email.trim().toLowerCase() === member.email.toLowerCase() &&
    selectedRole === member.role;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) resetFromMember();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="outline" size={size}>
            <Pencil className="size-4" aria-hidden />
            {t("edit")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("editMemberTitle")}</DialogTitle>
          <DialogDescription>{t("editMemberDescription")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form id={formId} action={formAction} className="space-y-5">
            <input type="hidden" name="userId" value={member.id} />
            <input type="hidden" name="role" value={selectedRole} />
            <FormField id={`${formId}-name`} label={t("name")}>
              <Input
                id={`${formId}-name`}
                name="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full"
                autoComplete="name"
              />
            </FormField>
            <FormField id={`${formId}-email`} label={t("email")}>
              <Input
                id={`${formId}-email`}
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full"
                autoComplete="email"
              />
            </FormField>
            <div className="space-y-2">
              <p
                className="text-sm font-medium text-slate-900"
                id={`${formId}-role-label`}
              >
                {t("role")}
              </p>
              <div
                role="radiogroup"
                aria-labelledby={`${formId}-role-label`}
                className="grid grid-cols-3 gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1"
              >
                {MEMBER_ROLES.map((option) => {
                  const selected = selectedRole === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setSelectedRole(option)}
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
                {t(`roleAccess.${selectedRole}`)}
              </p>
            </div>
          </form>
        </DialogBody>
        <DialogFooter className="gap-2 sm:justify-stretch">
          <DialogClose asChild>
            <Button
              type="button"
              variant="secondary"
              size="md"
              className="w-full sm:flex-1"
              disabled={pending}
            >
              {t("close")}
            </Button>
          </DialogClose>
          <Button
            type="submit"
            form={formId}
            size="md"
            className="w-full sm:flex-1"
            loading={pending}
            disabled={unchanged}
          >
            {t("saveMember")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

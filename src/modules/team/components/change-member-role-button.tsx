"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import { changeMemberRoleAction } from "@/app/actions/team";
import type { ChangeMemberRoleInput } from "@/modules/team/schema";
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
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const MEMBER_ROLES = ["MANAGER", "TECHNICIAN", "ACCOUNTANT"] as const;

type MemberRole = (typeof MEMBER_ROLES)[number];

type Props = {
  memberId: string;
  memberName: string;
  memberRole: string;
  trigger?: ReactNode;
  size?: "sm" | "md";
};

export function ChangeMemberRoleButton({
  memberId,
  memberName,
  memberRole,
  trigger,
  size = "md",
}: Props) {
  const t = useTranslations("team");
  const [open, setOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<MemberRole>(
    MEMBER_ROLES.includes(memberRole as MemberRole)
      ? (memberRole as MemberRole)
      : "MANAGER",
  );
  const [pending, startTransition] = useTransition();

  function onChangeRole() {
    startTransition(async () => {
      const result = await changeMemberRoleAction(
        memberId,
        selectedRole as ChangeMemberRoleInput["role"],
      );
      if (!result.ok) {
        toast.error(result.message ?? t("error"));
        return;
      }
      toast.success(result.message ?? t("roleUpdated"));
      setOpen(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setSelectedRole(
            MEMBER_ROLES.includes(memberRole as MemberRole)
              ? (memberRole as MemberRole)
              : "MANAGER",
          );
        }
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("changeRoleTitle")}</DialogTitle>
          <DialogDescription>
            {t("changeRoleDescription", { name: memberName })}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-2">
          <p
            className="text-sm font-medium text-slate-900"
            id="change-role-label"
          >
            {t("role")}
          </p>
          <div
            role="radiogroup"
            aria-labelledby="change-role-label"
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
            type="button"
            size="md"
            className="w-full sm:flex-1"
            loading={pending}
            disabled={selectedRole === memberRole}
            onClick={onChangeRole}
          >
            {t("saveRole")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

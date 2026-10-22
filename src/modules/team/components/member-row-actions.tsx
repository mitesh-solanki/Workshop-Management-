"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  changeMemberRoleAction,
  removeMemberAction,
} from "@/app/actions/team";
import type { ChangeMemberRoleInput } from "@/modules/team/schema";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const MEMBER_ROLES = ["MANAGER", "TECHNICIAN", "ACCOUNTANT"] as const;

type MemberRole = (typeof MEMBER_ROLES)[number];

type Props = {
  memberId: string;
  memberName: string;
  memberRole: string;
  /** Current signed-in user — Owner actions only apply to others. */
  canManage: boolean;
  isSelf: boolean;
};

export function MemberRowActions({
  memberId,
  memberName,
  memberRole,
  canManage,
  isSelf,
}: Props) {
  const t = useTranslations("team");
  const [roleOpen, setRoleOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<MemberRole>(
    MEMBER_ROLES.includes(memberRole as MemberRole)
      ? (memberRole as MemberRole)
      : "MANAGER",
  );
  const [pending, startTransition] = useTransition();

  if (!canManage || isSelf || memberRole === "OWNER") {
    return null;
  }

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
      setRoleOpen(false);
    });
  }

  function onConfirmRemove() {
    startTransition(async () => {
      const result = await removeMemberAction(memberId);
      if (!result.ok) {
        toast.error(result.message ?? t("error"));
        return;
      }
      toast.success(result.message ?? t("memberRemoved"));
      setRemoveOpen(false);
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => {
            setSelectedRole(
              MEMBER_ROLES.includes(memberRole as MemberRole)
                ? (memberRole as MemberRole)
                : "MANAGER",
            );
            setRoleOpen(true);
          }}
        >
          {t("changeRole")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          className="text-danger hover:bg-danger/5 hover:text-danger"
          onClick={() => setRemoveOpen(true)}
        >
          {t("removeMember")}
        </Button>
      </div>

      <Dialog open={roleOpen} onOpenChange={setRoleOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("changeRoleTitle")}</DialogTitle>
            <DialogDescription>
              {t("changeRoleDescription", { name: memberName })}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
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
                      "min-h-11 rounded-md px-2 text-caption font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600",
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

      <ConfirmDialog
        open={removeOpen}
        onOpenChange={(open) => {
          if (!open && !pending) setRemoveOpen(false);
        }}
        title={t("removeTitle")}
        description={t("removeConfirm", { name: memberName })}
        confirmLabel={t("removeMember")}
        variant="danger"
        loading={pending && removeOpen}
        onConfirm={onConfirmRemove}
      />
    </>
  );
}

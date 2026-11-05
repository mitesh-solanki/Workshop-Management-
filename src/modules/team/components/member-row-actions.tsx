"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Eye, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { removeMemberAction } from "@/app/actions/team";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { ChangeMemberRoleButton } from "@/modules/team/components/change-member-role-button";

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
  const [removeOpen, setRemoveOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const canEditRole =
    canManage && !isSelf && memberRole !== "OWNER";

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
      <div className="flex items-center gap-1.5 whitespace-nowrap">
        {canEditRole ? (
          <ChangeMemberRoleButton
            memberId={memberId}
            memberName={memberName}
            memberRole={memberRole}
            size="sm"
            trigger={
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                className="text-sm capitalize"
              >
                {t("changeRole")}
              </Button>
            }
          />
        ) : null}
        <Button asChild variant="outline" size="icon-sm">
          <Link href={`/team/${memberId}`} aria-label={t("view")}>
            <Eye className="size-4" aria-hidden />
          </Link>
        </Button>
        {canEditRole ? (
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={pending}
            className="text-danger hover:bg-danger/5 hover:text-danger"
            aria-label={t("removeMember")}
            onClick={() => setRemoveOpen(true)}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        ) : null}
      </div>

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

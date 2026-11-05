"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { deleteBonusAction } from "@/app/actions/payroll";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { EditBonusModal } from "@/modules/payroll/components/edit-bonus-modal";

type Props = {
  bonus: {
    id: string;
    amountPaise: number;
    givenOn: Date | string;
    method: "CASH" | "UPI" | "CARD" | "MIXED";
    note: string | null;
    inclusion: "pending" | "included" | "paid";
  };
};

export function BonusRowActions({ bonus }: Props) {
  const t = useTranslations("payroll");
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const canMutate = bonus.inclusion === "pending";

  function onConfirmDelete() {
    startTransition(async () => {
      const result = await deleteBonusAction(bonus.id);
      if (!result.ok) {
        toast.error(result.message ?? t("errors.bonusNotFound"));
        return;
      }
      toast.success(result.message ?? t("bonusDeleted"));
      setDeleteOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <div
        className="flex items-center justify-end gap-1.5"
        data-row-stop
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <EditBonusModal bonus={bonus} disabled={!canMutate} />
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={!canMutate || pending}
          className="text-danger hover:bg-danger/5 hover:text-danger"
          aria-label={t("deleteBonus")}
          title={!canMutate ? t("bonusLockedIncluded") : undefined}
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open && !pending) setDeleteOpen(false);
        }}
        title={t("deleteBonusTitle")}
        description={t("deleteBonusConfirm")}
        confirmLabel={t("deleteBonus")}
        variant="danger"
        loading={pending && deleteOpen}
        onConfirm={onConfirmDelete}
      />
    </>
  );
}

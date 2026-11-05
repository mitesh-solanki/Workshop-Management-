"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { deleteAdvanceAction } from "@/app/actions/payroll";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { EditAdvanceModal } from "@/modules/payroll/components/edit-advance-modal";

type Props = {
  advance: {
    id: string;
    amountPaise: number;
    remainingPaise: number;
    givenOn: Date | string;
    method: "CASH" | "UPI" | "CARD" | "MIXED";
    note: string | null;
  };
};

export function AdvanceRowActions({ advance }: Props) {
  const t = useTranslations("payroll");
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const canMutate = advance.remainingPaise === advance.amountPaise;

  function onConfirmDelete() {
    startTransition(async () => {
      const result = await deleteAdvanceAction(advance.id);
      if (!result.ok) {
        toast.error(result.message ?? t("errors.advanceNotFound"));
        return;
      }
      toast.success(result.message ?? t("advanceDeleted"));
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
        <EditAdvanceModal advance={advance} disabled={!canMutate} />
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={!canMutate || pending}
          className="text-danger hover:bg-danger/5 hover:text-danger"
          aria-label={t("deleteAdvance")}
          title={!canMutate ? t("errors.advanceAlreadyRecovered") : undefined}
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
        title={t("deleteAdvanceTitle")}
        description={t("deleteAdvanceConfirm")}
        confirmLabel={t("deleteAdvance")}
        variant="danger"
        loading={pending && deleteOpen}
        onConfirm={onConfirmDelete}
      />
    </>
  );
}

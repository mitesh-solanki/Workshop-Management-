"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { deleteBayAction } from "@/app/actions/bays";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import {
  EditBayModal,
  type EditBayValues,
} from "@/modules/bays/components/edit-bay-modal";

type BayRowActionsProps = {
  bay: EditBayValues;
  canWrite: boolean;
};

export function BayRowActions({ bay, canWrite }: BayRowActionsProps) {
  const t = useTranslations("bays");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!canWrite) return null;

  function onConfirmDelete() {
    startTransition(async () => {
      const result = await deleteBayAction(bay.id);
      if (!result.ok) {
        toast.error(result.message ?? t("error"));
        return;
      }
      toast.success(result.message ?? t("deleted"));
      setDeleteOpen(false);
    });
  }

  return (
    <>
      <div
        className="flex items-center gap-1.5"
        data-row-stop
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <EditBayModal bay={bay} />
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={pending}
          className="text-danger hover:bg-danger/5 hover:text-danger"
          aria-label={t("delete")}
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
        title={t("deleteTitle")}
        description={t("deleteConfirm", { name: bay.name })}
        confirmLabel={t("delete")}
        variant="danger"
        loading={pending && deleteOpen}
        onConfirm={onConfirmDelete}
      />
    </>
  );
}

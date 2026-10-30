"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Eye, Trash2 } from "lucide-react";
import { deleteInspectionAction } from "@/app/actions/inspections";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

type Props = {
  inspectionId: string;
  registrationNumber: string;
};

export function InspectionRowActions({
  inspectionId,
  registrationNumber,
}: Props) {
  const t = useTranslations("inspections");
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onConfirmDelete() {
    startTransition(async () => {
      const result = await deleteInspectionAction(inspectionId);
      if (!result.ok) {
        toast.error(result.message ?? t("errors.deleteFailed"));
        return;
      }
      toast.success(t("deleted"));
      setDeleteOpen(false);
      router.refresh();
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
        <Button asChild variant="outline" size="icon-sm">
          <Link
            href={`/inspections/${inspectionId}`}
            aria-label={t("view")}
          >
            <Eye className="size-4" aria-hidden />
          </Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
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
        description={t("deleteConfirm", { name: registrationNumber })}
        confirmLabel={t("delete")}
        variant="danger"
        loading={pending && deleteOpen}
        onConfirm={onConfirmDelete}
      />
    </>
  );
}

"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Eye, Trash2 } from "lucide-react";
import { deleteVendorAction } from "@/app/actions/vendors";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import {
  EditVendorModal,
  type EditVendorValues,
} from "@/modules/vendors/components/edit-vendor-modal";

type VendorRowActionsProps = {
  vendor: EditVendorValues;
  canWrite: boolean;
};

export function VendorRowActions({
  vendor,
  canWrite,
}: VendorRowActionsProps) {
  const t = useTranslations("vendors");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onConfirmDelete() {
    startTransition(async () => {
      const result = await deleteVendorAction(vendor.id);
      if (!result.ok) {
        toast.error(result.message ?? t("error"));
        return;
      }
      toast.success(result.message ?? t("deleted"));
      setDeleteOpen(false);
    });
  }

  return (
    <div
      className="flex items-center gap-1.5"
      data-row-stop
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <Button asChild variant="outline" size="icon">
        <Link href={`/vendors/${vendor.id}`} aria-label={t("view")}>
          <Eye className="size-4" aria-hidden />
        </Link>
      </Button>
      {canWrite ? (
        <>
          <EditVendorModal vendor={vendor} />
          <ConfirmDialog
            open={deleteOpen}
            onOpenChange={(next) => {
              if (pending && !next) return;
              setDeleteOpen(next);
            }}
            title={t("deleteTitle")}
            description={t("deleteConfirm", { name: vendor.name })}
            confirmLabel={t("delete")}
            variant="danger"
            loading={pending && deleteOpen}
            onConfirm={onConfirmDelete}
            trigger={
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={pending}
                className="text-danger hover:bg-danger/5 hover:text-danger"
                aria-label={t("delete")}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            }
          />
        </>
      ) : null}
    </div>
  );
}

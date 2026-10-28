"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { deleteVehicleAction } from "@/app/actions/vehicles";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import {
  EditVehicleModal,
  type EditVehicleValues,
} from "@/modules/vehicles/components/edit-vehicle-modal";

type VehicleRowActionsProps = {
  vehicle: EditVehicleValues;
  canWrite: boolean;
  /** When false, hide the view (eye) control. Default true. */
  showView?: boolean;
};

export function VehicleRowActions({
  vehicle,
  canWrite,
  showView = true,
}: VehicleRowActionsProps) {
  const t = useTranslations("vehicles");
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onConfirmDelete() {
    startTransition(async () => {
      const result = await deleteVehicleAction(
        vehicle.id,
        vehicle.customerId,
      );
      if (result && !result.ok) {
        toast.error(result.message ?? t("confirmDelete"));
        return;
      }
      toast.success(result?.message ?? t("deleted"));
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
        {showView ? (
          <Button asChild variant="outline" size="icon-sm">
            <Link href={`/vehicles/${vehicle.id}`} aria-label={t("view")}>
              <Eye className="size-4" aria-hidden />
            </Link>
          </Button>
        ) : null}
        {canWrite ? (
          <>
            <EditVehicleModal
              vehicle={vehicle}
              trigger={
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label={t("edit")}
                >
                  <Pencil className="size-4" aria-hidden />
                </Button>
              }
            />
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
          </>
        ) : null}
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open && !pending) setDeleteOpen(false);
        }}
        title={t("deleteTitle")}
        description={t("deleteConfirm", {
          name: vehicle.registrationNumber,
        })}
        confirmLabel={t("delete")}
        variant="danger"
        loading={pending && deleteOpen}
        onConfirm={onConfirmDelete}
      />
    </>
  );
}

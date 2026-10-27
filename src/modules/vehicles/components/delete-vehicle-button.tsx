"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { deleteVehicleAction } from "@/app/actions/vehicles";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type Props = {
  vehicleId: string;
  customerId: string;
  className?: string;
  /** Icon-only trigger (tables). Default is labeled Delete. */
  iconOnly?: boolean;
  registrationNumber?: string;
};

export function DeleteVehicleButton({
  vehicleId,
  customerId,
  className,
  iconOnly = false,
  registrationNumber,
}: Props) {
  const t = useTranslations("vehicles");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onConfirm() {
    startTransition(async () => {
      const result = await deleteVehicleAction(vehicleId, customerId);
      if (!result.ok) {
        toast.error(result.message ?? t("confirmDelete"));
        return;
      }
      toast.success(result.message ?? t("deleted"));
      setOpen(false);
      router.push(`/customers/${customerId}`);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={iconOnly ? "icon-sm" : "md"}
        disabled={pending}
        className={cn(
          "text-danger hover:bg-danger/5 hover:text-danger",
          !iconOnly && "min-h-11",
          className,
        )}
        aria-label={t("delete")}
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-4" aria-hidden />
        {iconOnly ? null : t("delete")}
      </Button>

      <ConfirmDialog
        open={open}
        onOpenChange={(next) => {
          if (!next && !pending) setOpen(false);
        }}
        title={t("deleteTitle")}
        description={
          registrationNumber
            ? t("deleteConfirm", { name: registrationNumber })
            : t("confirmDelete")
        }
        confirmLabel={t("delete")}
        variant="danger"
        loading={pending && open}
        onConfirm={onConfirm}
      />
    </>
  );
}

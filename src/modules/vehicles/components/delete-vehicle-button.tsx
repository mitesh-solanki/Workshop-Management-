"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { deleteVehicleAction } from "@/app/actions/vehicles";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";

type Props = {
  vehicleId: string;
  customerId: string;
  className?: string;
};

export function DeleteVehicleButton({
  vehicleId,
  customerId,
  className,
}: Props) {
  const t = useTranslations("vehicles");
  const action = useMemo(
    () => deleteVehicleAction.bind(null, vehicleId, customerId),
    [vehicleId, customerId],
  );

  return (
    <ConfirmDeleteButton
      label={t("delete")}
      confirmingLabel={t("deleting")}
      confirmMessage={t("confirmDelete")}
      className={className}
      action={action}
      translateMessage={(key) =>
        key === "cannotDeleteHasOrders" ? t("cannotDeleteHasOrders") : key
      }
    />
  );
}
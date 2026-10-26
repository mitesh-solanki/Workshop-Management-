"use client";

import Link from "next/link";
import { Eye } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  EditVehicleModal,
  type EditVehicleValues,
} from "@/modules/vehicles/components/edit-vehicle-modal";

type VehicleRowActionsProps = {
  vehicle: EditVehicleValues;
  canWrite: boolean;
};

export function VehicleRowActions({
  vehicle,
  canWrite,
}: VehicleRowActionsProps) {
  const t = useTranslations("vehicles");

  return (
    <div
      className="flex items-center gap-1.5"
      data-row-stop
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <Button asChild variant="outline" size="icon-sm">
        <Link href={`/vehicles/${vehicle.id}`} aria-label={t("view")}>
          <Eye className="size-4" aria-hidden />
        </Link>
      </Button>
      {canWrite ? <EditVehicleModal vehicle={vehicle} /> : null}
    </div>
  );
}

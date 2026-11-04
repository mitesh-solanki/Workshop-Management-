"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Car, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  NEXT_STEP_ACTION_BORDER_CLASS,
  useSequentialNextStepIndex,
} from "@/hooks/use-next-step-highlight";
import { cn } from "@/lib/utils";
import type { EditVehicleValues } from "@/modules/vehicles/components/edit-vehicle-modal";
import { VehicleRowActions } from "@/modules/vehicles/components/vehicle-row-actions";

export type CustomerVehicleRow = {
  id: string;
  registrationNumber: string;
  make: string;
  model: string;
  stateCode: string;
  year: number | null;
  odometer: number | null;
  insuranceExpiry: Date | string | null;
  pucExpiry: Date | string | null;
  fitnessExpiry: Date | string | null;
};

type Props = {
  vehicles: CustomerVehicleRow[];
  customerId: string;
  locale: string;
  canWrite: boolean;
  canCreateOrder?: boolean;
  canCreateInspection?: boolean;
  /** After create — flash Add Inspection / Job Card on this row. */
  highlightNextActionsForId?: string | null;
  empty: ReactNode;
};

function makeModel(vehicle: CustomerVehicleRow) {
  return `${vehicle.make} ${vehicle.model}`.trim();
}

function toEditValues(
  vehicle: CustomerVehicleRow,
  customerId: string,
): EditVehicleValues {
  return {
    id: vehicle.id,
    customerId,
    registrationNumber: vehicle.registrationNumber,
    make: vehicle.make,
    model: vehicle.model,
    stateCode: vehicle.stateCode,
    year: vehicle.year,
    odometer: vehicle.odometer,
    insuranceExpiry: vehicle.insuranceExpiry,
    pucExpiry: vehicle.pucExpiry,
    fitnessExpiry: vehicle.fitnessExpiry,
  };
}

function VehicleNextActions({
  customerId,
  vehicleId,
  canCreateInspection,
  canCreateOrder,
  canWrite,
  editValues,
  highlight,
  compact,
}: {
  customerId: string;
  vehicleId: string;
  canCreateInspection: boolean;
  canCreateOrder: boolean;
  canWrite: boolean;
  editValues: EditVehicleValues;
  highlight: boolean;
  compact?: boolean;
}) {
  const to = useTranslations("orders");
  const ti = useTranslations("inspections");
  const actionCount =
    Number(canCreateInspection) + Number(canCreateOrder);
  const activeIndex = useSequentialNextStepIndex(highlight, actionCount);
  let nextSlot = 0;
  const inspectionSlot = canCreateInspection ? nextSlot++ : -1;
  const jobCardSlot = canCreateOrder ? nextSlot++ : -1;

  return (
    <div
      className={cn(
        "flex flex-row flex-nowrap items-center justify-end gap-1.5",
        compact && "mt-3 flex-wrap border-t border-border pt-3",
      )}
    >
      {canCreateInspection ? (
        <Button
          asChild
          variant="outline"
          size="sm"
          className={cn(
            "shrink-0",
            compact && "min-h-10",
            highlight &&
              activeIndex === inspectionSlot &&
              NEXT_STEP_ACTION_BORDER_CLASS,
          )}
        >
          <Link
            href={`/inspections/new?customerId=${customerId}&vehicleId=${vehicleId}`}
          >
            <Plus className="size-3.5" aria-hidden />
            {ti("addInspection")}
          </Link>
        </Button>
      ) : null}
      {canCreateOrder ? (
        <Button
          asChild
          size="sm"
          className={cn(
            "shrink-0 text-white",
            compact && "min-h-10",
            highlight &&
              activeIndex === jobCardSlot &&
              NEXT_STEP_ACTION_BORDER_CLASS,
          )}
        >
          <Link
            href={`/orders/new?customerId=${customerId}&vehicleId=${vehicleId}`}
          >
            <Plus className="size-3.5 text-white" aria-hidden />
            {to("jobCard")}
          </Link>
        </Button>
      ) : null}
      <VehicleRowActions
        vehicle={editValues}
        canWrite={canWrite}
        showView={false}
      />
    </div>
  );
}

export function CustomerVehiclesList({
  vehicles,
  customerId,
  locale: _locale,
  canWrite,
  canCreateOrder = false,
  canCreateInspection = false,
  highlightNextActionsForId = null,
  empty,
}: Props) {
  const t = useTranslations("vehicles");

  if (vehicles.length === 0) {
    return empty;
  }

  return (
    <>
      <ul className="space-y-3 p-3 md:hidden">
        {vehicles.map((vehicle) => {
          const editValues = toEditValues(vehicle, customerId);
          return (
            <li
              key={vehicle.id}
              className="rounded-xl border border-border bg-card p-3.5 shadow-sm"
            >
              <Link
                href={`/vehicles/${vehicle.id}`}
                className="flex items-start gap-3"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Car className="size-5 text-muted-foreground" aria-hidden />
                </span>
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="block truncate text-sm font-semibold tracking-wide text-foreground">
                    {vehicle.registrationNumber}
                  </span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {makeModel(vehicle)}
                    {vehicle.year != null
                      ? ` · ${t("yearShort", { year: vehicle.year })}`
                      : ""}
                  </span>
                </span>
              </Link>
              <VehicleNextActions
                customerId={customerId}
                vehicleId={vehicle.id}
                canCreateInspection={canCreateInspection}
                canCreateOrder={canCreateOrder}
                canWrite={canWrite}
                editValues={editValues}
                highlight={highlightNextActionsForId === vehicle.id}
                compact
              />
            </li>
          );
        })}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <Table>
          <TableHeader className="bg-slate-100 [&_tr]:border-border">
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-slate-700">
                {t("columns.registration")}
              </TableHead>
              <TableHead className="text-slate-700">
                {t("columns.makeModel")}
              </TableHead>
              <TableHead className="w-[1%] whitespace-nowrap text-right text-slate-700">
                <span className="sr-only">{t("actions")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vehicles.map((vehicle) => {
              const editValues = toEditValues(vehicle, customerId);
              return (
                <TableRow key={vehicle.id} className="hover:bg-muted/50">
                  <TableCell className="whitespace-nowrap">
                    <Link
                      href={`/vehicles/${vehicle.id}`}
                      className="font-medium tracking-wide text-foreground"
                    >
                      {vehicle.registrationNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {makeModel(vehicle)}
                    {vehicle.year != null ? (
                      <span className="text-caption">
                        {" "}
                        · {t("yearShort", { year: vehicle.year })}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    <VehicleNextActions
                      customerId={customerId}
                      vehicleId={vehicle.id}
                      canCreateInspection={canCreateInspection}
                      canCreateOrder={canCreateOrder}
                      canWrite={canWrite}
                      editValues={editValues}
                      highlight={highlightNextActionsForId === vehicle.id}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

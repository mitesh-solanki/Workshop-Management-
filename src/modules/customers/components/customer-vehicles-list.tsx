"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Car } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

export function CustomerVehiclesList({
  vehicles,
  customerId,
  locale,
  canWrite,
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
                  </span>
                  {vehicle.odometer != null ? (
                    <span className="block text-caption text-muted-foreground">
                      {t("odometerShort", {
                        value: vehicle.odometer.toLocaleString(locale),
                      })}
                    </span>
                  ) : null}
                </span>
              </Link>
              <div className="mt-3 flex justify-end border-t border-border pt-3">
                <VehicleRowActions vehicle={editValues} canWrite={canWrite} />
              </div>
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
              <TableHead className="text-slate-700">
                {t("columns.odometer")}
              </TableHead>
              <TableHead className="w-[1%] text-right text-slate-700">
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
                  <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                    {vehicle.odometer != null
                      ? t("odometerShort", {
                          value: vehicle.odometer.toLocaleString(locale),
                        })
                      : t("notSet")}
                  </TableCell>
                  <TableCell className="text-right">
                    <VehicleRowActions
                      vehicle={editValues}
                      canWrite={canWrite}
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

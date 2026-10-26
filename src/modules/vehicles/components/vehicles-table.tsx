"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Car, Phone } from "lucide-react";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { VehicleRowActions } from "@/modules/vehicles/components/vehicle-row-actions";
import { VehicleSearch } from "@/modules/vehicles/components/vehicle-search";
import type { EditVehicleValues } from "@/modules/vehicles/components/edit-vehicle-modal";

export type VehicleTableRow = {
  id: string;
  customerId: string;
  registrationNumber: string;
  make: string;
  model: string;
  stateCode: string;
  year: number | null;
  odometer: number | null;
  insuranceExpiry: Date | string | null;
  pucExpiry: Date | string | null;
  fitnessExpiry: Date | string | null;
  customer: {
    id: string;
    name: string;
    phone: string;
  };
};

type VehiclesTableProps = {
  vehicles: VehicleTableRow[];
  page: number;
  pageSize: number;
  total: number;
  empty: React.ReactNode;
  canWrite?: boolean;
  toolbarActions?: React.ReactNode;
};

export function VehiclesTable({
  vehicles,
  page,
  pageSize,
  total,
  empty,
  canWrite = false,
  toolbarActions,
}: VehiclesTableProps) {
  const t = useTranslations("vehicles");

  const columns = useMemo<ColumnDef<VehicleTableRow>[]>(
    () => [
      {
        accessorKey: "registrationNumber",
        header: t("columns.registration"),
        cell: ({ row }) => (
          <span className="font-medium text-foreground">
            {row.original.registrationNumber}
          </span>
        ),
      },
      {
        id: "makeModel",
        accessorFn: (row) => `${row.make} ${row.model}`,
        header: t("columns.makeModel"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.make} {row.original.model}
          </span>
        ),
      },
      {
        id: "customer",
        accessorFn: (row) => row.customer.name,
        header: t("columns.customer"),
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">
              {row.original.customer.name}
            </p>
            <p className="truncate text-caption text-muted-foreground">
              {row.original.customer.phone}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "odometer",
        header: t("columns.odometer"),
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {row.original.odometer != null
              ? t("odometerShort", { value: row.original.odometer })
              : t("notSet")}
          </span>
        ),
      },
      {
        id: "actions",
        header: t("actions"),
        meta: { className: "w-[1%] whitespace-nowrap" },
        cell: ({ row }) => {
          const v = row.original;
          const editValues: EditVehicleValues = {
            id: v.id,
            customerId: v.customerId,
            registrationNumber: v.registrationNumber,
            make: v.make,
            model: v.model,
            stateCode: v.stateCode,
            year: v.year,
            odometer: v.odometer,
            insuranceExpiry: v.insuranceExpiry,
            pucExpiry: v.pucExpiry,
            fitnessExpiry: v.fitnessExpiry,
          };
          return (
            <VehicleRowActions vehicle={editValues} canWrite={canWrite} />
          );
        },
      },
    ],
    [t, canWrite],
  );

  return (
    <DataTable
      columns={columns}
      data={vehicles}
      empty={empty}
      defaultPageSize={10}
      getRowHref={(row) => `/vehicles/${row.id}`}
      toolbar={<VehicleSearch actions={toolbarActions} />}
      pagination={{
        pageIndex: Math.max(0, page - 1),
        pageSize,
        rowCount: total,
      }}
      renderMobileCard={(row) => {
        const vehicle = row.original;
        const editValues: EditVehicleValues = {
          id: vehicle.id,
          customerId: vehicle.customerId,
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
        return (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                <Car className="size-5 text-muted-foreground" aria-hidden />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-base font-semibold text-foreground">
                  {vehicle.registrationNumber}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {vehicle.make} {vehicle.model}
                </p>
              </div>
            </div>
            <div className="rounded-lg bg-muted/50 px-3 py-2.5">
              <p className="truncate text-sm font-medium text-foreground">
                {vehicle.customer.name}
              </p>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Phone className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">{vehicle.customer.phone}</span>
              </p>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
              <p className="text-xs text-muted-foreground">{t("actions")}</p>
              <VehicleRowActions vehicle={editValues} canWrite={canWrite} />
            </div>
          </div>
        );
      }}
    />
  );
}

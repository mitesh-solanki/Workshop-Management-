"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Phone } from "lucide-react";
import { InitialsAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { CustomerRowActions } from "@/modules/customers/components/customer-row-actions";
import { CustomerSearch } from "@/modules/customers/components/customer-search";

export type CustomerTableRow = {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  notes: string | null;
  vehicles: { registrationNumber: string }[];
};

type CustomersTableProps = {
  customers: CustomerTableRow[];
  page: number;
  pageSize: number;
  total: number;
  empty: React.ReactNode;
  canWrite?: boolean;
  toolbarActions?: React.ReactNode;
};

function VehicleBadges({
  vehicles,
  emptyLabel,
}: {
  vehicles: CustomerTableRow["vehicles"];
  emptyLabel: string;
}) {
  if (vehicles.length === 0) {
    return <span className="text-muted-foreground">{emptyLabel}</span>;
  }
  return (
    <div className="flex max-w-full flex-wrap gap-1.5">
      {vehicles.slice(0, 3).map((vehicle) => (
        <Badge key={vehicle.registrationNumber} variant="secondary">
          {vehicle.registrationNumber}
        </Badge>
      ))}
      {vehicles.length > 3 ? (
        <Badge variant="outline">+{vehicles.length - 3}</Badge>
      ) : null}
    </div>
  );
}

export function CustomersTable({
  customers,
  page,
  pageSize,
  total,
  empty,
  canWrite = false,
  toolbarActions,
}: CustomersTableProps) {
  const t = useTranslations("customers");

  const columns = useMemo<ColumnDef<CustomerTableRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("columns.name"),
        cell: ({ row }) => (
          <span className="font-medium text-foreground">
            {row.original.name}
          </span>
        ),
      },
      {
        accessorKey: "phone",
        header: t("columns.phone"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.phone}</span>
        ),
      },
      {
        id: "vehicles",
        accessorFn: (row) => row.vehicles.length,
        header: t("columns.vehicles"),
        cell: ({ row }) => (
          <VehicleBadges
            vehicles={row.original.vehicles}
            emptyLabel={t("noVehicles")}
          />
        ),
      },
      {
        id: "actions",
        header: t("actions"),
        meta: { className: "w-[1%] whitespace-nowrap" },
        cell: ({ row }) => (
          <CustomerRowActions
            customer={{
              id: row.original.id,
              name: row.original.name,
              phone: row.original.phone,
              address: row.original.address,
              notes: row.original.notes,
            }}
            canWrite={canWrite}
          />
        ),
      },
    ],
    [t, canWrite],
  );

  return (
    <DataTable
      columns={columns}
      data={customers}
      empty={empty}
      defaultPageSize={10}
      getRowHref={(row) => `/customers/${row.id}`}
      toolbar={<CustomerSearch actions={toolbarActions} />}
      pagination={{
        pageIndex: Math.max(0, page - 1),
        pageSize,
        rowCount: total,
      }}
      renderMobileCard={(row) => {
        const customer = row.original;
        return (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <InitialsAvatar name={customer.name} size="default" />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-base font-semibold text-foreground">
                  {customer.name}
                </p>
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Phone className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{customer.phone}</span>
                </p>
              </div>
            </div>

            <div className="rounded-lg bg-muted/50 px-3 py-2.5">
              <p className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {t("columns.vehicles")}
              </p>
              <VehicleBadges
                vehicles={customer.vehicles}
                emptyLabel={t("noVehicles")}
              />
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
              <p className="text-xs text-muted-foreground">{t("actions")}</p>
              <CustomerRowActions
                customer={{
                  id: customer.id,
                  name: customer.name,
                  phone: customer.phone,
                  address: customer.address,
                  notes: customer.notes,
                }}
                canWrite={canWrite}
              />
            </div>
          </div>
        );
      }}
    />
  );
}

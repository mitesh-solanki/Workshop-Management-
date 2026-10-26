"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Phone } from "lucide-react";
import { InitialsAvatar } from "@/components/ui/avatar";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { formatRupees } from "@/lib/money";
import { VendorRowActions } from "@/modules/vendors/components/vendor-row-actions";
import { VendorSearch } from "@/modules/vendors/components/vendor-search";

export type VendorTableRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  address: string | null;
  notes: string | null;
  outstandingPaise: number;
};

type VendorsTableProps = {
  vendors: VendorTableRow[];
  page: number;
  pageSize: number;
  total: number;
  empty: React.ReactNode;
  canWrite?: boolean;
  toolbarActions?: React.ReactNode;
};

export function VendorsTable({
  vendors,
  page,
  pageSize,
  total,
  empty,
  canWrite = false,
  toolbarActions,
}: VendorsTableProps) {
  const t = useTranslations("vendors");

  const columns = useMemo<ColumnDef<VendorTableRow>[]>(
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
          <span className="text-muted-foreground">
            {row.original.phone ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "gstin",
        header: t("columns.gstin"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.gstin ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "outstandingPaise",
        header: t("columns.outstanding"),
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums text-foreground">
            {formatRupees(row.original.outstandingPaise)}
          </span>
        ),
      },
      {
        id: "actions",
        header: t("actions"),
        meta: { className: "w-[1%] whitespace-nowrap" },
        cell: ({ row }) => (
          <VendorRowActions
            vendor={{
              id: row.original.id,
              name: row.original.name,
              phone: row.original.phone,
              email: row.original.email,
              address: row.original.address,
              gstin: row.original.gstin,
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
      data={vendors}
      empty={empty}
      defaultPageSize={10}
      getRowHref={(row) => `/vendors/${row.id}`}
      toolbar={<VendorSearch actions={toolbarActions} />}
      pagination={{
        pageIndex: Math.max(0, page - 1),
        pageSize,
        rowCount: total,
      }}
      renderMobileCard={(row) => {
        const vendor = row.original;
        return (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <InitialsAvatar name={vendor.name} size="default" />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-base font-semibold text-foreground">
                  {vendor.name}
                </p>
                {vendor.phone ? (
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Phone className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{vendor.phone}</span>
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/50 px-3 py-2.5">
              <div>
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {t("columns.gstin")}
                </p>
                <p className="mt-0.5 text-sm text-foreground">
                  {vendor.gstin ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {t("columns.outstanding")}
                </p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
                  {formatRupees(vendor.outstandingPaise)}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
              <p className="text-xs text-muted-foreground">{t("actions")}</p>
              <VendorRowActions
                vendor={{
                  id: vendor.id,
                  name: vendor.name,
                  phone: vendor.phone,
                  email: vendor.email,
                  address: vendor.address,
                  gstin: vendor.gstin,
                  notes: vendor.notes,
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

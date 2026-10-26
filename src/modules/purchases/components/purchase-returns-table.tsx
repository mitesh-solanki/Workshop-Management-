"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { formatRupees } from "@/lib/money";
import { PurchaseReturnSearch } from "@/modules/purchases/components/purchase-return-search";

export type PurchaseReturnTableRow = {
  id: string;
  quantity: number;
  creditPaise: number;
  createdAt: Date | string;
  vendor: { id: string; name: string };
  part: { id: string; name: string; sku: string; unit: string };
  vendorBill: { id: string; billNumber: string | null } | null;
};

type PurchaseReturnsTableProps = {
  returns: PurchaseReturnTableRow[];
  page: number;
  pageSize: number;
  total: number;
  empty: React.ReactNode;
  toolbarActions?: React.ReactNode;
};

export function PurchaseReturnsTable({
  returns,
  page,
  pageSize,
  total,
  empty,
  toolbarActions,
}: PurchaseReturnsTableProps) {
  const t = useTranslations("purchaseReturns");
  const locale = useLocale();
  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    [locale],
  );

  const columns = useMemo<ColumnDef<PurchaseReturnTableRow>[]>(
    () => [
      {
        id: "part",
        accessorFn: (row) => row.part.name,
        header: t("columns.part"),
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">
              {row.original.part.name}
            </p>
            <p className="truncate text-caption text-muted-foreground">
              {row.original.part.sku}
            </p>
          </div>
        ),
      },
      {
        id: "vendor",
        accessorFn: (row) => row.vendor.name,
        header: t("columns.vendor"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.vendor.name}</span>
        ),
      },
      {
        accessorKey: "quantity",
        header: t("columns.quantity"),
        cell: ({ row }) => (
          <span className="tabular-nums text-foreground">
            {row.original.quantity} {row.original.part.unit}
          </span>
        ),
      },
      {
        accessorKey: "creditPaise",
        header: t("columns.credit"),
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums text-foreground">
            {formatRupees(row.original.creditPaise)}
          </span>
        ),
      },
      {
        accessorKey: "createdAt",
        header: t("columns.date"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {dateFmt.format(new Date(row.original.createdAt))}
          </span>
        ),
      },
    ],
    [t, dateFmt],
  );

  return (
    <DataTable
      columns={columns}
      data={returns}
      empty={empty}
      defaultPageSize={10}
      getRowHref={(row) => `/vendors/${row.vendor.id}?section=returns`}
      toolbar={<PurchaseReturnSearch actions={toolbarActions} />}
      pagination={{
        pageIndex: Math.max(0, page - 1),
        pageSize,
        rowCount: total,
      }}
      renderMobileCard={(row) => {
        const item = row.original;
        return (
          <div className="space-y-3">
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-foreground">
                {item.part.name}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                {item.vendor.name} · {item.quantity} {item.part.unit}
              </p>
            </div>
            <div className="flex justify-between text-sm">
              <span className="font-semibold tabular-nums">
                {formatRupees(item.creditPaise)}
              </span>
              <span className="text-muted-foreground">
                {dateFmt.format(new Date(item.createdAt))}
              </span>
            </div>
          </div>
        );
      }}
    />
  );
}

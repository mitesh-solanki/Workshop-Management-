"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { PurchaseOrderSearch } from "@/modules/purchases/components/purchase-order-search";

export type PurchaseOrderTableRow = {
  id: string;
  number: string;
  status: string;
  createdAt: Date | string;
  vendor: { id: string; name: string };
  lines: { quantityOrdered: number; quantityReceived: number }[];
};

type PurchaseOrdersTableProps = {
  orders: PurchaseOrderTableRow[];
  page: number;
  pageSize: number;
  total: number;
  empty: React.ReactNode;
  toolbarActions?: React.ReactNode;
};

function statusVariant(
  status: string,
): "warning" | "secondary" | "success" | "outline" {
  if (status === "PENDING") return "warning";
  if (status === "PARTIALLY_RECEIVED") return "secondary";
  if (status === "RECEIVED") return "success";
  return "outline";
}

export function PurchaseOrdersTable({
  orders,
  page,
  pageSize,
  total,
  empty,
  toolbarActions,
}: PurchaseOrdersTableProps) {
  const t = useTranslations("purchaseOrders");
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

  const columns = useMemo<ColumnDef<PurchaseOrderTableRow>[]>(
    () => [
      {
        accessorKey: "number",
        header: t("columns.number"),
        cell: ({ row }) => (
          <span className="font-medium text-foreground">
            {row.original.number}
          </span>
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
        accessorKey: "status",
        header: t("columns.status"),
        cell: ({ row }) => (
          <Badge variant={statusVariant(row.original.status)}>
            {t(`statuses.${row.original.status}`)}
          </Badge>
        ),
      },
      {
        id: "lines",
        accessorFn: (row) => row.lines.length,
        header: t("columns.lines"),
        cell: ({ row }) => {
          const ordered = row.original.lines.reduce(
            (sum, line) => sum + line.quantityOrdered,
            0,
          );
          const received = row.original.lines.reduce(
            (sum, line) => sum + line.quantityReceived,
            0,
          );
          return (
            <span className="tabular-nums text-muted-foreground">
              {received}/{ordered}
            </span>
          );
        },
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
      data={orders}
      empty={empty}
      defaultPageSize={10}
      getRowHref={(row) => `/purchase-orders/${row.id}`}
      toolbar={<PurchaseOrderSearch actions={toolbarActions} />}
      pagination={{
        pageIndex: Math.max(0, page - 1),
        pageSize,
        rowCount: total,
      }}
      renderMobileCard={(row) => {
        const order = row.original;
        const ordered = order.lines.reduce(
          (sum, line) => sum + line.quantityOrdered,
          0,
        );
        const received = order.lines.reduce(
          (sum, line) => sum + line.quantityReceived,
          0,
        );
        return (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-foreground">
                  {order.number}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {order.vendor.name}
                </p>
              </div>
              <Badge variant={statusVariant(order.status)}>
                {t(`statuses.${order.status}`)}
              </Badge>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>
                {received}/{ordered}
              </span>
              <span>{dateFmt.format(new Date(order.createdAt))}</span>
            </div>
          </div>
        );
      }}
    />
  );
}

"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { PartsRequestSearch } from "@/modules/purchases/components/parts-request-search";
import { PartsRequestRowActions } from "@/modules/purchases/components/parts-request-row-actions";
import type { OpenPartsRequestOption } from "@/modules/purchases/components/create-purchase-order-modal";

export type PartsRequestTableRow = {
  id: string;
  status: string;
  quantity: number;
  notes: string | null;
  part: { id: string; name: string; sku: string; unit: string };
  purchaseOrder: { id: string; number: string } | null;
};

type PartsRequestsTableProps = {
  requests: PartsRequestTableRow[];
  page: number;
  pageSize: number;
  total: number;
  empty: React.ReactNode;
  toolbarActions?: React.ReactNode;
  vendors: { id: string; name: string }[];
  openRequests: OpenPartsRequestOption[];
};

function statusVariant(
  status: string,
): "warning" | "secondary" | "danger" | "outline" {
  if (status === "OPEN") return "warning";
  if (status === "ORDERED") return "secondary";
  if (status === "CANCELLED") return "danger";
  return "outline";
}

export function PartsRequestsTable({
  requests,
  page,
  pageSize,
  total,
  empty,
  toolbarActions,
  vendors,
  openRequests,
}: PartsRequestsTableProps) {
  const t = useTranslations("partsRequests");

  const columns = useMemo<ColumnDef<PartsRequestTableRow>[]>(
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
        accessorKey: "quantity",
        header: t("columns.quantity"),
        cell: ({ row }) => (
          <span className="tabular-nums text-foreground">
            {row.original.quantity} {row.original.part.unit}
          </span>
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
        id: "po",
        accessorFn: (row) => row.purchaseOrder?.number ?? "",
        header: t("columns.purchaseOrder"),
        cell: ({ row }) =>
          row.original.purchaseOrder ? (
            <span className="text-muted-foreground">
              {row.original.purchaseOrder.number}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: "actions",
        header: t("columns.actions"),
        enableSorting: false,
        meta: { className: "w-[1%] whitespace-nowrap text-right" },
        cell: ({ row }) => (
          <PartsRequestRowActions
            request={row.original}
            vendors={vendors}
            openRequests={openRequests}
          />
        ),
      },
    ],
    [t, vendors, openRequests],
  );

  return (
    <DataTable
      columns={columns}
      data={requests}
      empty={empty}
      defaultPageSize={10}
      toolbar={<PartsRequestSearch actions={toolbarActions} />}
      pagination={{
        pageIndex: Math.max(0, page - 1),
        pageSize,
        rowCount: total,
      }}
      renderMobileCard={(row) => {
        const request = row.original;
        return (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-foreground">
                  {request.part.name}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {request.part.sku} · {request.quantity} {request.part.unit}
                </p>
              </div>
              <Badge variant={statusVariant(request.status)}>
                {t(`statuses.${request.status}`)}
              </Badge>
            </div>
            {request.purchaseOrder ? (
              <p className="text-sm text-muted-foreground">
                {t("columns.purchaseOrder")}: {request.purchaseOrder.number}
              </p>
            ) : null}
            <PartsRequestRowActions
              request={request}
              vendors={vendors}
              openRequests={openRequests}
            />
          </div>
        );
      }}
    />
  );
}

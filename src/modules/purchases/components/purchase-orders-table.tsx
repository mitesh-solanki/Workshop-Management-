"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { formatRupees, type Paise } from "@/lib/money";
import { cn } from "@/lib/utils";
import { PurchaseOrderRowActions } from "@/modules/purchases/components/purchase-order-row-actions";
import { PurchaseOrderSearch } from "@/modules/purchases/components/purchase-order-search";

const VISIBLE_PART_BADGES = 3;

const PART_BADGE_COLORS = [
  "border-blue-200 bg-blue-50 text-blue-800",
  "border-emerald-200 bg-emerald-50 text-emerald-800",
  "border-amber-200 bg-amber-50 text-amber-900",
  "border-sky-200 bg-sky-50 text-sky-800",
  "border-rose-200 bg-rose-50 text-rose-800",
  "border-teal-200 bg-teal-50 text-teal-800",
  "border-orange-200 bg-orange-50 text-orange-900",
  "border-indigo-200 bg-indigo-50 text-indigo-800",
] as const;

function partBadgeColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return PART_BADGE_COLORS[hash % PART_BADGE_COLORS.length]!;
}

export type PurchaseOrderTableRow = {
  id: string;
  number: string;
  status: string;
  createdAt: Date | string;
  vendor: { id: string; name: string } | null;
  totalPaise: number;
  lines: {
    quantityOrdered: number;
    quantityReceived: number;
    unitCostPaise?: number;
    part: { name: string };
  }[];
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
  if (status === "OPEN") return "outline";
  if (status === "PENDING") return "warning";
  if (status === "PARTIALLY_RECEIVED") return "secondary";
  if (status === "RECEIVED") return "success";
  return "outline";
}

function PartNameBadges({
  lines,
  moreLabel,
}: {
  lines: PurchaseOrderTableRow["lines"];
  moreLabel: (count: number) => string;
}) {
  if (lines.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  const visible = lines.slice(0, VISIBLE_PART_BADGES);
  const remaining = lines.length - visible.length;

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      {visible.map((line, index) => (
        <Badge
          key={`${line.part.name}-${index}`}
          variant="outline"
          className={cn(
            "max-w-[14rem] truncate border",
            partBadgeColor(line.part.name),
          )}
          title={line.part.name}
        >
          {line.part.name}
        </Badge>
      ))}
      {remaining > 0 ? (
        <Badge
          variant="outline"
          className="border-slate-200 bg-slate-50 text-slate-700"
          title={moreLabel(remaining)}
        >
          {moreLabel(remaining)}
        </Badge>
      ) : null}
    </div>
  );
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
        accessorFn: (row) => row.vendor?.name ?? "",
        header: t("columns.vendor"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.vendor?.name ?? t("vendorNotSet")}
          </span>
        ),
      },
      {
        id: "parts",
        accessorFn: (row) =>
          row.lines.map((line) => line.part.name).join(" "),
        header: t("columns.parts"),
        cell: ({ row }) => (
          <PartNameBadges
            lines={row.original.lines}
            moreLabel={(count) => t("partsMore", { count })}
          />
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
        id: "total",
        accessorFn: (row) => row.totalPaise,
        header: t("columns.amount"),
        cell: ({ row }) => (
          <span className="font-medium tabular-nums text-foreground">
            {formatRupees(row.original.totalPaise as Paise, locale)}
          </span>
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
      {
        id: "actions",
        header: t("columns.actions"),
        enableSorting: false,
        cell: ({ row }) => <PurchaseOrderRowActions order={row.original} />,
      },
    ],
    [t, dateFmt, locale],
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
                  {order.vendor?.name ?? t("vendorNotSet")}
                </p>
              </div>
              <Badge variant={statusVariant(order.status)}>
                {t(`statuses.${order.status}`)}
              </Badge>
            </div>
            <PartNameBadges
              lines={order.lines}
              moreLabel={(count) => t("partsMore", { count })}
            />
            <div className="flex justify-between gap-3 text-sm">
              <span className="text-muted-foreground">
                {received}/{ordered}
              </span>
              <span className="font-medium tabular-nums text-foreground">
                {formatRupees(order.totalPaise as Paise, locale)}
              </span>
            </div>
            <div className="flex justify-end text-sm text-muted-foreground">
              <span>{dateFmt.format(new Date(order.createdAt))}</span>
            </div>
            <div className="flex justify-end">
              <PurchaseOrderRowActions order={order} />
            </div>
          </div>
        );
      }}
    />
  );
}

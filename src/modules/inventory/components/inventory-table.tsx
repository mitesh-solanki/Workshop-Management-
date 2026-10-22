"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { formatRupees } from "@/lib/money";
import { InventoryRowActions } from "@/modules/inventory/components/inventory-row-actions";
import { InventorySearch } from "@/modules/inventory/components/inventory-search";

export type InventoryTableRow = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  hsn: string;
  quantityOnHand: number;
  lowStockLevel: number;
  sellingPricePaise: number;
  purchasePricePaise: number;
  gstRatePercent: number;
};

type Props = {
  items: InventoryTableRow[];
  empty: React.ReactNode;
  canWrite?: boolean;
};

export function InventoryTable({ items, empty, canWrite = false }: Props) {
  const t = useTranslations("inventory");

  const columns = useMemo<ColumnDef<InventoryTableRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("columns.name"),
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">
              {row.original.name}
            </p>
            <p className="truncate text-caption text-muted-foreground">
              {row.original.sku}
            </p>
          </div>
        ),
      },
      {
        id: "unit",
        accessorKey: "unit",
        header: t("columns.unit"),
        cell: ({ row }) => {
          const unit = row.original.unit;
          const label =
            unit === "pcs" ||
            unit === "set" ||
            unit === "pair" ||
            unit === "litre" ||
            unit === "ml" ||
            unit === "kg" ||
            unit === "g" ||
            unit === "metre"
              ? t(`units.${unit}`)
              : unit;
          return <span className="text-muted-foreground">{label}</span>;
        },
      },
      {
        id: "stock",
        accessorFn: (row) => row.quantityOnHand,
        header: t("columns.stock"),
        cell: ({ row }) => {
          const { quantityOnHand, lowStockLevel, unit } = row.original;
          const low = quantityOnHand <= lowStockLevel;
          return (
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={
                  low ? "font-semibold text-amber-800" : "text-foreground"
                }
              >
                {t("stockCount", { count: quantityOnHand, unit })}
              </span>
              {low ? <Badge variant="warning">{t("lowBadge")}</Badge> : null}
            </div>
          );
        },
      },
      {
        id: "price",
        accessorFn: (row) => row.sellingPricePaise,
        header: t("columns.price"),
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">
            {formatRupees(row.original.sellingPricePaise)}
          </span>
        ),
      },
      {
        id: "hsn",
        accessorKey: "hsn",
        header: t("columns.hsn"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.hsn}</span>
        ),
      },
      {
        id: "actions",
        header: t("actions"),
        meta: { className: "w-[1%] whitespace-nowrap" },
        cell: ({ row }) => (
          <InventoryRowActions
            canWrite={canWrite}
            part={{
              id: row.original.id,
              name: row.original.name,
              sku: row.original.sku,
              unit: row.original.unit,
              purchasePricePaise: row.original.purchasePricePaise,
              sellingPricePaise: row.original.sellingPricePaise,
              gstRatePercent: row.original.gstRatePercent,
              hsn: row.original.hsn,
              lowStockLevel: row.original.lowStockLevel,
            }}
          />
        ),
      },
    ],
    [t, canWrite],
  );

  return (
    <DataTable
      columns={columns}
      data={items}
      empty={empty}
      defaultPageSize={10}
      getRowHref={(row) => `/inventory/${row.id}`}
      toolbar={<InventorySearch className="max-w-md" />}
    />
  );
}

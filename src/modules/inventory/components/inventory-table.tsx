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

export function InventoryTable({
  items,
  empty,
  canWrite = false,
}: Props) {
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
              quantityOnHand: row.original.quantityOnHand,
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
      toolbar={<InventorySearch />}
      renderMobileCard={(row) => {
        const item = row.original;
        const unit = item.unit;
        const unitLabel =
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
        const low = item.quantityOnHand <= item.lowStockLevel;
        return (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="truncate text-base font-semibold text-foreground">
                  {item.name}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {item.sku}
                  {item.hsn ? ` · ${t("columns.hsn")} ${item.hsn}` : ""}
                </p>
              </div>
              {low ? <Badge variant="warning">{t("lowBadge")}</Badge> : null}
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/50 px-3 py-2.5">
              <div>
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {t("columns.stock")}
                </p>
                <p
                  className={
                    low
                      ? "mt-0.5 text-sm font-semibold text-amber-800"
                      : "mt-0.5 text-sm font-semibold text-foreground"
                  }
                >
                  {t("stockCount", {
                    count: item.quantityOnHand,
                    unit: item.unit,
                  })}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {t("columns.price")}
                </p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
                  {formatRupees(item.sellingPricePaise)}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {t("columns.unit")}
                </p>
                <p className="mt-0.5 text-sm text-foreground">{unitLabel}</p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
              <p className="text-xs text-muted-foreground">{t("actions")}</p>
              <InventoryRowActions
                canWrite={canWrite}
                part={{
                  id: item.id,
                  name: item.name,
                  sku: item.sku,
                  unit: item.unit,
                  purchasePricePaise: item.purchasePricePaise,
                  sellingPricePaise: item.sellingPricePaise,
                  gstRatePercent: item.gstRatePercent,
                  hsn: item.hsn,
                  lowStockLevel: item.lowStockLevel,
                  quantityOnHand: item.quantityOnHand,
                }}
              />
            </div>
          </div>
        );
      }}
    />
  );
}

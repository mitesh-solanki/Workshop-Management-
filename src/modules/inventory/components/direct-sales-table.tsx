"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { sumLineGst } from "@/lib/gst";
import { formatRupees } from "@/lib/money";
import type {
  DirectSaleCustomerOption,
  DirectSalePartOption,
} from "@/modules/inventory/components/direct-sale-form";
import { DirectSaleRowActions } from "@/modules/inventory/components/direct-sale-row-actions";

export type DirectSaleTableRow = {
  id: string;
  walkInName: string | null;
  notes: string | null;
  createdAt: Date | string;
  customer: { id: string; name: string; phone: string } | null;
  lines: Array<{
    id: string;
    quantity: number;
    unitPricePaise: number;
    gstRatePercent: number;
    hsn: string;
    part: { id: string; name: string; sku: string; unit: string };
  }>;
};

type Props = {
  sales: DirectSaleTableRow[];
  empty: React.ReactNode;
  toolbarActions?: React.ReactNode;
  canWrite: boolean;
  parts: DirectSalePartOption[];
  customers: DirectSaleCustomerOption[];
};

export function DirectSalesTable({
  sales,
  empty,
  toolbarActions,
  canWrite,
  parts,
  customers,
}: Props) {
  const t = useTranslations("inventory");
  const locale = useLocale();
  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [locale],
  );

  function buyerLabel(sale: DirectSaleTableRow): string {
    if (sale.customer?.name) {
      return sale.customer.name;
    }
    if (sale.walkInName?.trim()) {
      return `${t("walkIn")} · ${sale.walkInName.trim()}`;
    }
    return t("walkIn");
  }

  const columns = useMemo<ColumnDef<DirectSaleTableRow>[]>(
    () => [
      {
        id: "buyer",
        accessorFn: (row) => buyerLabel(row),
        header: t("columns.buyer"),
        cell: ({ row }) => (
          <span className="font-medium text-foreground">
            {buyerLabel(row.original)}
          </span>
        ),
      },
      {
        id: "items",
        accessorFn: (row) => row.lines.length,
        header: t("columns.items"),
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {t("lineCount", { count: row.original.lines.length })}
          </span>
        ),
      },
      {
        id: "total",
        accessorFn: (row) =>
          sumLineGst(
            row.lines.map((line) => ({
              quantity: line.quantity,
              unitPricePaise: line.unitPricePaise,
              gstRatePercent: line.gstRatePercent,
            })),
          ).totalPaise,
        header: t("columns.total"),
        cell: ({ row }) => {
          const total = sumLineGst(
            row.original.lines.map((line) => ({
              quantity: line.quantity,
              unitPricePaise: line.unitPricePaise,
              gstRatePercent: line.gstRatePercent,
            })),
          ).totalPaise;
          return (
            <span className="font-semibold tabular-nums text-foreground">
              {formatRupees(total)}
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
        header: t("actions"),
        enableSorting: false,
        meta: { className: "w-[1%] whitespace-nowrap text-right" },
        cell: ({ row }) => (
          <DirectSaleRowActions
            sale={row.original}
            canWrite={canWrite}
            parts={parts}
            customers={customers}
          />
        ),
      },
    ],
    [t, dateFmt, canWrite, parts, customers],
  );

  return (
    <DataTable
      columns={columns}
      data={sales}
      empty={empty}
      defaultPageSize={10}
      toolbar={
        toolbarActions ? (
          <div className="flex justify-end">{toolbarActions}</div>
        ) : undefined
      }
      renderMobileCard={(row) => {
        const sale = row.original;
        const total = sumLineGst(
          sale.lines.map((line) => ({
            quantity: line.quantity,
            unitPricePaise: line.unitPricePaise,
            gstRatePercent: line.gstRatePercent,
          })),
        ).totalPaise;
        return (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-foreground">
                  {buyerLabel(sale)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {dateFmt.format(new Date(sale.createdAt))} ·{" "}
                  {t("lineCount", { count: sale.lines.length })}
                </p>
              </div>
              <p className="shrink-0 font-semibold tabular-nums text-foreground">
                {formatRupees(total)}
              </p>
            </div>
            <DirectSaleRowActions
              sale={sale}
              canWrite={canWrite}
              parts={parts}
              customers={customers}
            />
          </div>
        );
      }}
    />
  );
}

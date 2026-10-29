"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { formatRupees } from "@/lib/money";
import { cn } from "@/lib/utils";
import { VendorBillSearch } from "@/modules/purchases/components/vendor-bill-search";

export type VendorBillTableRow = {
  id: string;
  billNumber: string | null;
  billDate: Date | string;
  amountPaise: number;
  outstandingPaise: number;
  vendor: { id: string; name: string };
  purchaseOrder: { id: string; number: string } | null;
};

type VendorBillsTableProps = {
  bills: VendorBillTableRow[];
  page: number;
  pageSize: number;
  total: number;
  empty: React.ReactNode;
  toolbarActions?: React.ReactNode;
};

export function VendorBillsTable({
  bills,
  page,
  pageSize,
  total,
  empty,
  toolbarActions,
}: VendorBillsTableProps) {
  const t = useTranslations("vendorBills");
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

  const columns = useMemo<ColumnDef<VendorBillTableRow>[]>(
    () => [
      {
        id: "bill",
        accessorFn: (row) => row.billNumber ?? "",
        header: t("columns.bill"),
        cell: ({ row }) => (
          <span className="font-medium text-foreground">
            {row.original.billNumber ?? t("billUntitled")}
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
        accessorKey: "billDate",
        header: t("columns.date"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {dateFmt.format(new Date(row.original.billDate))}
          </span>
        ),
      },
      {
        accessorKey: "amountPaise",
        header: t("columns.amount"),
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums text-foreground">
            {formatRupees(row.original.amountPaise)}
          </span>
        ),
      },
      {
        accessorKey: "outstandingPaise",
        header: t("columns.outstanding"),
        cell: ({ row }) => {
          const outstanding = row.original.outstandingPaise;
          const paidOff = outstanding <= 0;
          return (
            <span
              className={cn(
                "font-semibold tabular-nums",
                paidOff ? "text-emerald-700" : "text-amber-700",
              )}
            >
              {formatRupees(outstanding)}
            </span>
          );
        },
      },
    ],
    [t, dateFmt],
  );

  return (
    <DataTable
      columns={columns}
      data={bills}
      empty={empty}
      defaultPageSize={10}
      getRowHref={(row) => `/vendor-bills/${row.id}`}
      toolbar={<VendorBillSearch actions={toolbarActions} />}
      pagination={{
        pageIndex: Math.max(0, page - 1),
        pageSize,
        rowCount: total,
      }}
      renderMobileCard={(row) => {
        const bill = row.original;
        return (
          <div className="space-y-3">
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-foreground">
                {bill.billNumber ?? t("billUntitled")}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                {bill.vendor.name} · {dateFmt.format(new Date(bill.billDate))}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/50 px-3 py-2.5">
              <div>
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {t("columns.amount")}
                </p>
                <p className="mt-0.5 font-semibold tabular-nums">
                  {formatRupees(bill.amountPaise)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {t("columns.outstanding")}
                </p>
                <p
                  className={cn(
                    "mt-0.5 font-semibold tabular-nums",
                    bill.outstandingPaise <= 0
                      ? "text-emerald-700"
                      : "text-amber-700",
                  )}
                >
                  {formatRupees(bill.outstandingPaise)}
                </p>
              </div>
            </div>
          </div>
        );
      }}
    />
  );
}

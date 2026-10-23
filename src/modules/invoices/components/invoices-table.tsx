"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { formatRupees } from "@/lib/money";
import { InvoiceRowActions } from "@/modules/invoices/components/invoice-row-actions";
import { InvoiceSearch } from "@/modules/invoices/components/invoice-search";
import { InvoiceStatusFilter } from "@/modules/invoices/components/invoice-status-filter";
import type { InvoicePaymentStatus } from "@/modules/invoices/payment-status";
import type { InvoiceListItem } from "@/modules/invoices/types";

type InvoicesTableProps = {
  invoices: InvoiceListItem[];
  page: number;
  pageSize: number;
  total: number;
  empty: React.ReactNode;
};

function PaymentStatusBadge({
  paymentStatus,
  label,
}: {
  paymentStatus: InvoicePaymentStatus;
  label: string;
}) {
  const variant =
    paymentStatus === "PAID"
      ? "success"
      : paymentStatus === "OVERDUE"
        ? "danger"
        : paymentStatus === "DUE"
          ? "warning"
          : "secondary";

  return <Badge variant={variant}>{label}</Badge>;
}

export function InvoicesTable({
  invoices,
  page,
  pageSize,
  total,
  empty,
}: InvoicesTableProps) {
  const t = useTranslations("invoices");
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

  const columns = useMemo<ColumnDef<InvoiceListItem>[]>(
    () => [
      {
        accessorKey: "invoiceNumber",
        header: t("columns.number"),
        cell: ({ row }) => (
          <span className="font-medium text-foreground">
            {row.original.invoiceNumber ?? t("draftLabel")}
          </span>
        ),
      },
      {
        id: "date",
        accessorFn: (row) => row.finalizedAt ?? row.createdAt,
        header: t("columns.date"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {dateFmt.format(
              new Date(row.original.finalizedAt ?? row.original.createdAt),
            )}
          </span>
        ),
      },
      {
        accessorKey: "customerName",
        header: t("columns.customer"),
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">
              {row.original.customerName}
            </p>
            <p className="truncate text-caption text-muted-foreground">
              {row.original.customerPhone}
            </p>
          </div>
        ),
      },
      {
        id: "vehicle",
        accessorFn: (row) => row.vehicleRegistration ?? "",
        header: t("columns.vehicle"),
        cell: ({ row }) =>
          row.original.vehicleRegistration ? (
            <Badge variant="secondary">{row.original.vehicleRegistration}</Badge>
          ) : (
            <span className="text-muted-foreground">{t("noVehicle")}</span>
          ),
      },
      {
        accessorKey: "totalPaise",
        header: t("columns.amount"),
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums text-foreground">
            {formatRupees(row.original.totalPaise)}
          </span>
        ),
      },
      {
        accessorKey: "paymentStatus",
        header: t("columns.status"),
        cell: ({ row }) => (
          <PaymentStatusBadge
            paymentStatus={row.original.paymentStatus}
            label={t(`paymentStatuses.${row.original.paymentStatus}`)}
          />
        ),
      },
      {
        accessorKey: "pendingBalancePaise",
        header: t("columns.balance"),
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {formatRupees(row.original.pendingBalancePaise)}
          </span>
        ),
      },
      {
        id: "actions",
        header: t("actions"),
        meta: { className: "w-[1%] whitespace-nowrap" },
        cell: ({ row }) => (
          <InvoiceRowActions serviceOrderId={row.original.serviceOrderId} />
        ),
      },
    ],
    [t, dateFmt],
  );

  return (
    <DataTable
      columns={columns}
      data={invoices}
      empty={empty}
      defaultPageSize={10}
      getRowHref={(row) => `/orders/${row.serviceOrderId}?section=billing`}
      toolbar={
        <div className="flex w-full flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <InvoiceSearch className="w-full md:max-w-md" />
          <InvoiceStatusFilter />
        </div>
      }
      pagination={{
        pageIndex: Math.max(0, page - 1),
        pageSize,
        rowCount: total,
      }}
      renderMobileCard={(row) => {
        const invoice = row.original;
        return (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700">
                <FileText className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-base font-semibold text-foreground">
                  {invoice.invoiceNumber ?? t("draftLabel")}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {invoice.customerName}
                  {invoice.vehicleRegistration
                    ? ` · ${invoice.vehicleRegistration}`
                    : ""}
                </p>
              </div>
              <PaymentStatusBadge
                paymentStatus={invoice.paymentStatus}
                label={t(`paymentStatuses.${invoice.paymentStatus}`)}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/50 px-3 py-2.5">
              <div>
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {t("columns.amount")}
                </p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
                  {formatRupees(invoice.totalPaise)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {t("columns.balance")}
                </p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
                  {formatRupees(invoice.pendingBalancePaise)}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {t("columns.date")}
                </p>
                <p className="mt-0.5 text-sm text-foreground">
                  {dateFmt.format(
                    new Date(invoice.finalizedAt ?? invoice.createdAt),
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
              <p className="text-xs text-muted-foreground">{t("actions")}</p>
              <InvoiceRowActions serviceOrderId={invoice.serviceOrderId} />
            </div>
          </div>
        );
      }}
    />
  );
}

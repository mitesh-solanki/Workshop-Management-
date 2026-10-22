"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Car, ClipboardList, User } from "lucide-react";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/search-input";
import { StatusBadge } from "@/components/ui/status-badge";
import type { ServiceOrderStatus } from "@/lib/service-order-status";
import { JobCardRowActions } from "@/modules/service-orders/components/job-card-row-actions";

export type OrderTableRow = {
  id: string;
  customerId: string;
  status: ServiceOrderStatus;
  complaint: string;
  bay: string | null;
  vehicle: { registrationNumber: string; make: string; model: string };
  customer: { name: string };
  technician: { name: string | null; email: string } | null;
};

type OrdersTableProps = {
  orders: OrderTableRow[];
  canWrite?: boolean;
  emptyAction?: React.ReactNode;
};

export function OrdersTable({
  orders,
  canWrite = false,
  emptyAction,
}: OrdersTableProps) {
  const t = useTranslations("orders");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((order) => {
      const registration = order.vehicle.registrationNumber.toLowerCase();
      const customer = order.customer.name.toLowerCase();
      const complaint = order.complaint.toLowerCase();
      const makeModel =
        `${order.vehicle.make} ${order.vehicle.model}`.toLowerCase();
      const tech = (
        order.technician?.name?.trim() ||
        order.technician?.email ||
        ""
      ).toLowerCase();
      const statusLabel = t(`statuses.${order.status}`).toLowerCase();
      return (
        registration.includes(q) ||
        customer.includes(q) ||
        complaint.includes(q) ||
        makeModel.includes(q) ||
        tech.includes(q) ||
        statusLabel.includes(q)
      );
    });
  }, [orders, query, t]);

  const columns = useMemo<ColumnDef<OrderTableRow>[]>(
    () => [
      {
        id: "vehicle",
        accessorFn: (row) => row.vehicle.registrationNumber,
        header: t("columns.vehicle"),
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">
              {row.original.vehicle.registrationNumber}
            </p>
            <p className="truncate text-caption text-muted-foreground">
              {row.original.vehicle.make} {row.original.vehicle.model}
            </p>
          </div>
        ),
      },
      {
        id: "customer",
        accessorFn: (row) => row.customer.name,
        header: t("columns.customer"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.customer.name}
          </span>
        ),
      },
      {
        accessorKey: "complaint",
        header: t("columns.complaint"),
        cell: ({ row }) => (
          <span className="line-clamp-2 max-w-xs text-muted-foreground">
            {row.original.complaint}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: t("columns.status"),
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.status}
            label={t(`statuses.${row.original.status}`)}
          />
        ),
      },
      {
        id: "technician",
        accessorFn: (row) =>
          row.technician?.name?.trim() || row.technician?.email || "",
        header: t("columns.technician"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.technician
              ? row.original.technician.name?.trim() ||
                row.original.technician.email
              : t("technicianUnassigned")}
          </span>
        ),
      },
      {
        id: "actions",
        header: t("actions"),
        meta: { className: "w-[1%] whitespace-nowrap" },
        cell: ({ row }) => (
          <JobCardRowActions
            orderId={row.original.id}
            customerId={row.original.customerId}
            label={row.original.vehicle.registrationNumber}
            canWrite={canWrite}
          />
        ),
      },
    ],
    [t, canWrite],
  );

  const hasQuery = Boolean(query.trim());
  const empty = (
    <EmptyState
      icon={ClipboardList}
      title={hasQuery ? t("emptySearchTitle") : t("emptyTitle")}
      description={
        hasQuery ? t("emptySearchDescription") : t("emptyDescription")
      }
      action={!hasQuery ? emptyAction : undefined}
    />
  );

  return (
    <DataTable
      columns={columns}
      data={filtered}
      empty={empty}
      defaultPageSize={10}
      getRowHref={(row) => `/orders/${row.id}`}
      toolbar={
        <SearchInput
          value={query}
          onValueChange={setQuery}
          label={t("searchLabel")}
          placeholder={t("searchPlaceholder")}
          className="w-full md:max-w-md"
        />
      }
      renderMobileCard={(row) => {
        const order = row.original;
        const techLabel = order.technician
          ? order.technician.name?.trim() || order.technician.email
          : t("technicianUnassigned");
        return (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="truncate text-base font-semibold text-foreground">
                  {order.vehicle.registrationNumber}
                </p>
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <User className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{order.customer.name}</span>
                </p>
              </div>
              <StatusBadge
                status={order.status}
                label={t(`statuses.${order.status}`)}
              />
            </div>

            <p className="line-clamp-2 text-sm text-muted-foreground">
              {order.complaint}
            </p>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Car className="size-3.5 shrink-0" aria-hidden />
                {order.vehicle.make} {order.vehicle.model}
              </span>
              <span>{`${t("technician")}: ${techLabel}`}</span>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
              <p className="text-xs text-muted-foreground">{t("actions")}</p>
              <JobCardRowActions
                orderId={order.id}
                customerId={order.customerId}
                label={order.vehicle.registrationNumber}
                canWrite={canWrite}
              />
            </div>
          </div>
        );
      }}
    />
  );
}

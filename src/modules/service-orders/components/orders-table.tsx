"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { CalendarClock, CalendarDays, Car, ClipboardList, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FormSelect } from "@/components/ui/form-select";
import { ListFiltersResetButton } from "@/components/ui/list-filters-reset-button";
import { ListSortMenu } from "@/components/ui/list-sort-menu";
import { SearchInput } from "@/components/ui/search-input";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  SERVICE_ORDER_STATUSES,
  type ServiceOrderStatus,
} from "@/lib/service-order-status";
import { cn } from "@/lib/utils";
import { JobCardRowActions } from "@/modules/service-orders/components/job-card-row-actions";
import { formatTechniciansList } from "@/modules/service-orders/technicians";

type OrderSort = "newest" | "oldest" | "reg_asc" | "reg_desc";
type StatusFilter = "" | ServiceOrderStatus | "NEEDS_PRICING";

export type OrderTableRow = {
  id: string;
  customerId: string;
  status: ServiceOrderStatus;
  complaint: string;
  bay: string | null;
  createdAt: string | Date;
  expectedCompletion: string | Date | null;
  needsPricing?: boolean;
  vehicle: { registrationNumber: string; make: string; model: string };
  customer: { name: string };
  technician: { name: string | null; email: string } | null;
  technicianAssignments?: Array<{
    technicianId: string;
    technician: { id?: string; name: string | null; email: string };
  }>;
};

type OrdersTableProps = {
  orders: OrderTableRow[];
  canWrite?: boolean;
  canDelete?: boolean;
  showNeedsPricing?: boolean;
  emptyAction?: React.ReactNode;
};

function formatDueDate(
  value: Date | string | null,
  locale: string,
  empty: string,
): string {
  if (!value) {
    return empty;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return empty;
  }
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function isOverdue(value: Date | string | null): boolean {
  if (!value) {
    return false;
  }
  const date = value instanceof Date ? value : new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
}

export function OrdersTable({
  orders,
  canWrite = false,
  canDelete = false,
  showNeedsPricing = false,
  emptyAction,
}: OrdersTableProps) {
  const t = useTranslations("orders");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<OrderSort>("newest");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const filtersActive =
    Boolean(query.trim()) || sort !== "newest" || Boolean(statusFilter);

  const sortOptions = useMemo(
    () => [
      { value: "newest" as const, label: t("sort.newest") },
      { value: "oldest" as const, label: t("sort.oldest") },
      { value: "reg_asc" as const, label: t("sort.regAsc") },
      { value: "reg_desc" as const, label: t("sort.regDesc") },
    ],
    [t],
  );

  const statusFilterOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [
      { value: "", label: t("filters.all") },
    ];
    if (showNeedsPricing) {
      options.push({ value: "NEEDS_PRICING", label: t("needsPricing") });
    }
    options.push(
      ...SERVICE_ORDER_STATUSES.map((status) => ({
        value: status,
        label: t(`statuses.${status}`),
      })),
    );
    return options;
  }, [t, showNeedsPricing]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = orders.filter((order) => {
      if (statusFilter === "NEEDS_PRICING") {
        if (!order.needsPricing) return false;
      } else if (statusFilter && order.status !== statusFilter) {
        return false;
      }

      if (!q) return true;

      const registration = order.vehicle.registrationNumber.toLowerCase();
      const customer = order.customer.name.toLowerCase();
      const complaint = order.complaint.toLowerCase();
      const makeModel =
        `${order.vehicle.make} ${order.vehicle.model}`.toLowerCase();
      const tech = formatTechniciansList(order, "").toLowerCase();
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

    matched.sort((a, b) => {
      if (sort === "reg_asc" || sort === "reg_desc") {
        const cmp = a.vehicle.registrationNumber.localeCompare(
          b.vehicle.registrationNumber,
        );
        return sort === "reg_asc" ? cmp : -cmp;
      }
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return sort === "oldest" ? aTime - bTime : bTime - aTime;
    });

    return matched;
  }, [orders, query, sort, statusFilter, t]);

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
        id: "createdOn",
        accessorFn: (row) => new Date(row.createdAt).getTime(),
        header: t("columns.createdOn"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatDueDate(row.original.createdAt, locale, t("dueNone"))}
          </span>
        ),
      },
      {
        id: "dueDate",
        accessorFn: (row) =>
          row.expectedCompletion
            ? new Date(row.expectedCompletion).getTime()
            : 0,
        header: t("columns.dueDate"),
        cell: ({ row }) => {
          const overdue =
            row.original.status !== "COMPLETED" &&
            isOverdue(row.original.expectedCompletion);
          return (
            <span
              className={cn(
                "text-muted-foreground",
                overdue && "font-medium text-amber-700",
              )}
            >
              {formatDueDate(
                row.original.expectedCompletion,
                locale,
                t("dueNone"),
              )}
            </span>
          );
        },
      },
      {
        accessorKey: "status",
        header: t("columns.status"),
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge
              status={row.original.status}
              label={t(`statuses.${row.original.status}`)}
            />
            {showNeedsPricing && row.original.needsPricing ? (
              <Badge variant="warning">{t("needsPricing")}</Badge>
            ) : null}
          </div>
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
            canDelete={canDelete}
            status={row.original.status}
          />
        ),
      },
    ],
    [t, canWrite, canDelete, locale, showNeedsPricing],
  );

  useEffect(() => {
    if (!showNeedsPricing && statusFilter === "NEEDS_PRICING") {
      setStatusFilter("");
    }
  }, [showNeedsPricing, statusFilter]);

  const hasQuery = Boolean(query.trim());
  const hasStatusFilter = Boolean(statusFilter);
  const empty = (
    <EmptyState
      icon={ClipboardList}
      title={
        hasQuery || hasStatusFilter ? t("emptySearchTitle") : t("emptyTitle")
      }
      description={
        hasQuery || hasStatusFilter
          ? t("emptySearchDescription")
          : t("emptyDescription")
      }
      action={!hasQuery && !hasStatusFilter ? emptyAction : undefined}
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
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <SearchInput
            value={query}
            onValueChange={setQuery}
            label={t("searchLabel")}
            placeholder={t("searchPlaceholder")}
            className="w-full min-w-0 flex-1 md:max-w-md"
          />
          <div className="flex shrink-0 items-center gap-2">
            <div className="min-w-0">
              <label htmlFor="orders-status-filter" className="sr-only">
                {t("filterStatusLabel")}
              </label>
              <FormSelect
                id="orders-status-filter"
                value={statusFilter}
                onValueChange={(value) =>
                  setStatusFilter(value as StatusFilter)
                }
                options={statusFilterOptions}
                className="w-auto min-w-42"
                triggerClassName="h-11 min-h-11 w-auto min-w-42 rounded-lg border-slate-200 bg-white px-3 text-[13px] font-semibold shadow-xs"
              />
            </div>
            <ListSortMenu
              value={sort}
              options={sortOptions}
              onChange={setSort}
              ariaLabel={t("sortLabel")}
            />
            <ListFiltersResetButton
              label={tc("resetFilters")}
              disabled={!filtersActive}
              onReset={() => {
                setQuery("");
                setSort("newest");
                setStatusFilter("");
              }}
            />
          </div>
        </div>
      }
      renderMobileCard={(row) => {
        const order = row.original;
        const overdue =
          order.status !== "COMPLETED" && isOverdue(order.expectedCompletion);
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
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <StatusBadge
                  status={order.status}
                  label={t(`statuses.${order.status}`)}
                />
                {showNeedsPricing && order.needsPricing ? (
                  <Badge variant="warning">{t("needsPricing")}</Badge>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Car className="size-3.5 shrink-0" aria-hidden />
                {order.vehicle.make} {order.vehicle.model}
              </span>
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3.5 shrink-0" aria-hidden />
                {`${t("columns.createdOn")}: ${formatDueDate(
                  order.createdAt,
                  locale,
                  t("dueNone"),
                )}`}
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1",
                  overdue && "font-medium text-amber-700",
                )}
              >
                <CalendarClock className="size-3.5 shrink-0" aria-hidden />
                {`${t("columns.dueDate")}: ${formatDueDate(
                  order.expectedCompletion,
                  locale,
                  t("dueNone"),
                )}`}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
              <p className="text-xs text-muted-foreground">{t("actions")}</p>
              <JobCardRowActions
                orderId={order.id}
                customerId={order.customerId}
                label={order.vehicle.registrationNumber}
                canWrite={canWrite}
                canDelete={canDelete}
                status={order.status}
              />
            </div>
          </div>
        );
      }}
    />
  );
}

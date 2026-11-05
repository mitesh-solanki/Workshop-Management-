"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
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
  calendarDateKeyBoundsUtc,
  calendarDayOffsetBoundsUtc,
  calendarDaysAheadBoundsUtc,
} from "@/lib/calendar-day";
import {
  SERVICE_ORDER_STATUSES,
  type ServiceOrderStatus,
} from "@/lib/service-order-status";
import { cn } from "@/lib/utils";
import { JobCardRowActions } from "@/modules/service-orders/components/job-card-row-actions";
import { formatTechniciansList } from "@/modules/service-orders/technicians";

type OrderSort = "newest" | "oldest" | "reg_asc" | "reg_desc";
type StatusFilter = "" | ServiceOrderStatus | "NEEDS_PRICING";
type DueFilter =
  | ""
  | "overdue"
  | "today"
  | "tomorrow"
  | "days3"
  | "days7"
  | "soon"
  | "custom";

const DUE_FILTERS = [
  "overdue",
  "today",
  "tomorrow",
  "days3",
  "days7",
  "soon",
  "custom",
] as const;

function parseStatusFilter(
  raw: string | null,
  allowNeedsPricing: boolean,
): StatusFilter {
  if (!raw) return "";
  if (raw === "NEEDS_PRICING") {
    return allowNeedsPricing ? "NEEDS_PRICING" : "";
  }
  return (SERVICE_ORDER_STATUSES as readonly string[]).includes(raw)
    ? (raw as ServiceOrderStatus)
    : "";
}

function parseDueFilter(raw: string | null): DueFilter {
  if (!raw) return "";
  return (DUE_FILTERS as readonly string[]).includes(raw)
    ? (raw as DueFilter)
    : "";
}

function parseDateKey(raw: string | null): string {
  if (!raw) return "";
  return calendarDateKeyBoundsUtc(raw) ? raw : "";
}

function expectedCompletionTime(
  expectedCompletion: Date | string | null,
): number | null {
  if (!expectedCompletion) return null;
  const date =
    expectedCompletion instanceof Date
      ? expectedCompletion
      : new Date(expectedCompletion);
  if (Number.isNaN(date.getTime())) return null;
  return date.getTime();
}

function matchesDueFilter(
  expectedCompletion: Date | string | null,
  status: ServiceOrderStatus,
  dueFilter: DueFilter,
  dueFrom: string,
  dueTo: string,
): boolean {
  if (!dueFilter) return true;
  if (status === "COMPLETED") return false;
  const time = expectedCompletionTime(expectedCompletion);
  if (time == null) return false;

  if (dueFilter === "overdue") {
    return time < Date.now();
  }

  if (dueFilter === "custom") {
    const fromBound = dueFrom ? calendarDateKeyBoundsUtc(dueFrom) : null;
    const toBound = dueTo
      ? calendarDateKeyBoundsUtc(dueTo)
      : dueFrom
        ? calendarDateKeyBoundsUtc(dueFrom)
        : null;
    if (!fromBound && !toBound) return true;
    const start = fromBound?.start.getTime() ?? Number.NEGATIVE_INFINITY;
    const end = toBound?.end.getTime() ?? Number.POSITIVE_INFINITY;
    return time >= start && time < end;
  }

  let window: { start: Date; end: Date };
  if (dueFilter === "today") {
    window = calendarDayOffsetBoundsUtc(0);
  } else if (dueFilter === "tomorrow") {
    window = calendarDayOffsetBoundsUtc(1);
  } else if (dueFilter === "days3") {
    window = calendarDaysAheadBoundsUtc(3);
  } else if (dueFilter === "days7") {
    window = calendarDaysAheadBoundsUtc(7);
  } else {
    window = calendarDaysAheadBoundsUtc(1);
  }
  return time >= window.start.getTime() && time < window.end.getTime();
}

export type OrderTableRow = {
  id: string;
  customerId: string;
  vehicleId: string;
  jobCardNumber: number;
  status: ServiceOrderStatus;
  complaint: string;
  bay: string | null;
  createdAt: string | Date;
  expectedCompletion: string | Date | null;
  needsPricing?: boolean;
  paperCopyCount?: number;
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
  canUploadPaper?: boolean;
  showNeedsPricing?: boolean;
  showReport?: boolean;
  emptyAction?: React.ReactNode;
};

function formatDueDate(
  value: Date | string | null,
  locale: string,
  empty: string,
  withTime = false,
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
    ...(withTime
      ? { hour: "2-digit" as const, minute: "2-digit" as const }
      : {}),
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
  canUploadPaper = false,
  showNeedsPricing = false,
  showReport = false,
  emptyAction,
}: OrdersTableProps) {
  const t = useTranslations("orders");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const urlStatus = parseStatusFilter(
    searchParams.get("status"),
    showNeedsPricing,
  );
  const urlDue = parseDueFilter(searchParams.get("due"));
  const urlDueFrom = parseDateKey(searchParams.get("dueFrom"));
  const urlDueTo = parseDateKey(searchParams.get("dueTo"));
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<OrderSort>("newest");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(urlStatus);
  const [dueFilter, setDueFilter] = useState<DueFilter>(urlDue);
  const [dueFrom, setDueFrom] = useState(urlDueFrom);
  const [dueTo, setDueTo] = useState(urlDueTo);
  const filtersActive =
    Boolean(query.trim()) ||
    sort !== "newest" ||
    Boolean(statusFilter) ||
    Boolean(dueFilter) ||
    Boolean(dueFrom) ||
    Boolean(dueTo);

  useEffect(() => {
    setStatusFilter(urlStatus);
  }, [urlStatus]);

  useEffect(() => {
    setDueFilter(urlDue);
  }, [urlDue]);

  useEffect(() => {
    setDueFrom(urlDueFrom);
    setDueTo(urlDueTo);
  }, [urlDueFrom, urlDueTo]);

  function replaceListParams(next: {
    status?: StatusFilter;
    due?: DueFilter;
    dueFrom?: string;
    dueTo?: string;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    const status = next.status !== undefined ? next.status : statusFilter;
    const due = next.due !== undefined ? next.due : dueFilter;
    const from = next.dueFrom !== undefined ? next.dueFrom : dueFrom;
    const to = next.dueTo !== undefined ? next.dueTo : dueTo;

    if (status) {
      params.set("status", status);
    } else {
      params.delete("status");
    }
    if (due) {
      params.set("due", due);
    } else {
      params.delete("due");
    }
    if (due === "custom" && from) {
      params.set("dueFrom", from);
    } else {
      params.delete("dueFrom");
    }
    if (due === "custom" && to) {
      params.set("dueTo", to);
    } else {
      params.delete("dueTo");
    }

    const queryString = params.toString();
    startTransition(() => {
      router.replace(queryString ? `/orders?${queryString}` : "/orders");
    });
  }

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

  const dueFilterOptions = useMemo(
    () => [
      { value: "", label: t("filters.dueAll") },
      { value: "overdue", label: t("filters.dueOverdue") },
      { value: "today", label: t("filters.dueToday") },
      { value: "tomorrow", label: t("filters.dueTomorrow") },
      { value: "days3", label: t("filters.dueNext3Days") },
      { value: "days7", label: t("filters.dueNext7Days") },
      { value: "custom", label: t("filters.dueCustom") },
    ],
    [t],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = orders.filter((order) => {
      if (statusFilter === "NEEDS_PRICING") {
        if (!order.needsPricing) return false;
      } else if (statusFilter && order.status !== statusFilter) {
        return false;
      }

      if (
        !matchesDueFilter(
          order.expectedCompletion,
          order.status,
          dueFilter,
          dueFrom,
          dueTo,
        )
      ) {
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
  }, [orders, query, sort, statusFilter, dueFilter, dueFrom, dueTo, t]);

  const columns = useMemo<ColumnDef<OrderTableRow>[]>(
    () => [
      {
        id: "jobCardNumber",
        accessorFn: (row) => row.jobCardNumber,
        header: t("columns.jobCardNumber"),
        cell: ({ row }) => (
          <span className="font-mono text-sm font-semibold text-foreground">
            {t("jobCardNumberShort", { number: row.original.jobCardNumber })}
          </span>
        ),
      },
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
            {formatDueDate(row.original.createdAt, locale, t("dueNone"), true)}
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
            vehicleId={row.original.vehicleId}
            label={row.original.vehicle.registrationNumber}
            canWrite={canWrite}
            canDelete={canDelete}
            canUploadPaper={canUploadPaper}
            hasPaperCopy={(row.original.paperCopyCount ?? 0) > 0}
            status={row.original.status}
            showReport={showReport}
          />
        ),
      },
    ],
    [t, canWrite, canDelete, canUploadPaper, locale, showNeedsPricing, showReport],
  );

  useEffect(() => {
    if (!showNeedsPricing && statusFilter === "NEEDS_PRICING") {
      setStatusFilter("");
    }
  }, [showNeedsPricing, statusFilter]);

  const hasQuery = Boolean(query.trim());
  const hasListFilter = Boolean(statusFilter) || Boolean(dueFilter);
  const empty = (
    <EmptyState
      icon={ClipboardList}
      title={
        hasQuery || hasListFilter ? t("emptySearchTitle") : t("emptyTitle")
      }
      description={
        hasQuery || hasListFilter
          ? t("emptySearchDescription")
          : t("emptyDescription")
      }
      action={!hasQuery && !hasListFilter ? emptyAction : undefined}
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
          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
            <div className="min-w-0">
              <label htmlFor="orders-status-filter" className="sr-only">
                {t("filterStatusLabel")}
              </label>
              <FormSelect
                id="orders-status-filter"
                value={statusFilter}
                onValueChange={(value) => {
                  const next = value as StatusFilter;
                  setStatusFilter(next);
                  replaceListParams({ status: next });
                }}
                options={statusFilterOptions}
                className="w-auto min-w-42"
                triggerClassName="h-11 min-h-11 w-auto min-w-42 rounded-lg border-slate-200 bg-white px-3 text-[13px] font-semibold shadow-xs"
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="orders-due-filter" className="sr-only">
                {t("filterDueLabel")}
              </label>
              <FormSelect
                id="orders-due-filter"
                value={dueFilter}
                onValueChange={(value) => {
                  const next = value as DueFilter;
                  setDueFilter(next);
                  if (next !== "custom") {
                    setDueFrom("");
                    setDueTo("");
                    replaceListParams({
                      due: next,
                      dueFrom: "",
                      dueTo: "",
                    });
                    return;
                  }
                  replaceListParams({ due: next });
                }}
                options={
                  dueFilter === "soon"
                    ? [
                        {
                          value: "soon",
                          label: t("filters.dueSoon"),
                        },
                        ...dueFilterOptions,
                      ]
                    : dueFilterOptions
                }
                className="w-auto min-w-44"
                triggerClassName="h-11 min-h-11 w-auto min-w-44 rounded-lg border-slate-200 bg-white px-3 text-[13px] font-semibold shadow-xs"
              />
            </div>
            {dueFilter === "custom" ? (
              <div className="flex h-11 min-h-11 w-full items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 shadow-xs sm:w-auto">
                <label htmlFor="orders-due-from" className="sr-only">
                  {t("filters.dueFrom")}
                </label>
                <input
                  id="orders-due-from"
                  type="date"
                  value={dueFrom}
                  onChange={(event) => {
                    const next = event.target.value;
                    setDueFrom(next);
                    replaceListParams({ due: "custom", dueFrom: next });
                  }}
                  className="h-9 min-w-0 flex-1 border-0 bg-transparent px-1 text-sm text-slate-800 outline-none sm:w-[9.5rem] sm:flex-none"
                />
                <span className="shrink-0 text-xs font-medium text-slate-400">
                  –
                </span>
                <label htmlFor="orders-due-to" className="sr-only">
                  {t("filters.dueTo")}
                </label>
                <input
                  id="orders-due-to"
                  type="date"
                  value={dueTo}
                  min={dueFrom || undefined}
                  onChange={(event) => {
                    const next = event.target.value;
                    setDueTo(next);
                    replaceListParams({ due: "custom", dueTo: next });
                  }}
                  className="h-9 min-w-0 flex-1 border-0 bg-transparent px-1 text-sm text-slate-800 outline-none sm:w-[9.5rem] sm:flex-none"
                />
              </div>
            ) : null}
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
                setDueFilter("");
                setDueFrom("");
                setDueTo("");
                startTransition(() => {
                  router.replace("/orders");
                });
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
                <p className="font-mono text-sm font-semibold text-foreground">
                  {t("jobCardNumberShort", { number: order.jobCardNumber })}
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
                  true,
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
                vehicleId={order.vehicleId}
                label={order.vehicle.registrationNumber}
                canWrite={canWrite}
                canDelete={canDelete}
                canUploadPaper={canUploadPaper}
                hasPaperCopy={(order.paperCopyCount ?? 0) > 0}
                status={order.status}
                showReport={showReport}
              />
            </div>
          </div>
        );
      }}
    />
  );
}

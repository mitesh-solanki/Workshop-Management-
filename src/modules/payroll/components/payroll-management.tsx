"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { IndianRupee, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { formatRupees } from "@/lib/money";
import {
  currentYearMonth,
  formatPeriodMonthYear,
} from "@/modules/payroll/date";
import { PayrollFilters } from "@/modules/payroll/components/payroll-filters";
import { PayrollLineActions } from "@/modules/payroll/components/payroll-line-editor";

function formatPaidOn(value: Date | string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

type LineRow = {
  id: string;
  userId: string;
  memberName: string;
  periodStart: Date | string;
  periodEnd: Date | string;
  basicPaise: number;
  bonusPaise: number;
  commissionPaise: number;
  advanceDeductedPaise: number;
  openAdvancePaise: number;
  adjustmentPaise: number;
  adjustmentNote: string | null;
  netPaise: number;
  status: "DRAFT" | "PAID";
  paidAt: Date | string | null;
  paidMethod: "CASH" | "UPI" | "CARD" | "MIXED" | null;
};

type Props = {
  yearMonth: string;
  status: "ALL" | "DRAFT" | "PAID";
  searchQuery: string;
  lines: LineRow[];
};

export function PayrollManagement(props: Props) {
  const t = useTranslations("payroll");
  const locale = useLocale();
  const q = props.searchQuery.trim();
  const addMonth =
    props.yearMonth !== "all" && /^\d{4}-\d{2}$/.test(props.yearMonth)
      ? props.yearMonth
      : currentYearMonth();

  const lines = useMemo(
    () =>
      props.lines.filter((line) =>
        q ? line.memberName.toLowerCase().includes(q.toLowerCase()) : true,
      ),
    [props.lines, q],
  );

  const hasActiveFilters =
    Boolean(q) || props.status !== "ALL" || props.yearMonth !== "all";

  const addPayroll = (
    <Button asChild size="md" className="min-h-11 gap-2">
      <Link href={`/payroll/new?month=${addMonth}`}>
        <Plus className="size-4" aria-hidden />
        {t("addPayroll")}
      </Link>
    </Button>
  );

  const lineColumns = useMemo<ColumnDef<LineRow>[]>(
    () => [
      {
        accessorKey: "memberName",
        header: t("columns.member"),
        cell: ({ row }) => (
          <Link
            href={`/team/${row.original.userId}`}
            className="font-medium text-foreground hover:underline"
            data-row-stop
          >
            {row.original.memberName}
          </Link>
        ),
      },
      {
        id: "month",
        header: t("columns.month"),
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {formatPeriodMonthYear(row.original.periodStart, locale)}
          </span>
        ),
      },
      {
        accessorKey: "basicPaise",
        header: t("columns.basic"),
        cell: ({ row }) => (
          <span className="font-bold tabular-nums text-slate-900">
            {formatRupees(row.original.basicPaise, locale)}
          </span>
        ),
      },
      {
        accessorKey: "advanceDeductedPaise",
        header: t("advanceShort"),
        cell: ({ row }) => {
          const value = row.original.advanceDeductedPaise;
          if (value <= 0) {
            return (
              <span className="text-sm text-muted-foreground">
                {t("rowAdvanceNone")}
              </span>
            );
          }
          return (
            <span className="font-bold tabular-nums text-amber-700">
              {formatRupees(value, locale)}
            </span>
          );
        },
      },
      {
        accessorKey: "adjustmentPaise",
        header: t("adjustmentShort"),
        cell: ({ row }) => {
          const value = row.original.adjustmentPaise;
          return (
            <span
              className={
                value > 0
                  ? "font-bold tabular-nums text-emerald-700"
                  : value < 0
                    ? "font-bold tabular-nums text-red-600"
                    : "font-bold tabular-nums text-slate-700"
              }
            >
              {formatRupees(value, locale)}
            </span>
          );
        },
      },
      {
        accessorKey: "netPaise",
        header: t("columns.netPay"),
        cell: ({ row }) => (
          <span className="font-bold tabular-nums text-blue-700">
            {formatRupees(row.original.netPaise, locale)}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: t("columns.status"),
        cell: ({ row }) => (
          <div className="flex flex-col items-start gap-1">
            <Badge
              variant={row.original.status === "PAID" ? "success" : "warning"}
            >
              {row.original.status === "PAID" ? t("paid") : t("unpaid")}
            </Badge>
            {row.original.status === "PAID" && row.original.paidAt ? (
              <span className="text-xs text-muted-foreground">
                {formatPaidOn(row.original.paidAt, locale)}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "paidMethod",
        header: t("columns.paymentMethod"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.paidMethod
              ? t(`methods.${row.original.paidMethod}`)
              : "—"}
          </span>
        ),
      },
      {
        id: "actions",
        header: t("columns.actions"),
        meta: { className: "w-[1%] whitespace-nowrap" },
        cell: ({ row }) => {
          const line = row.original;
          return (
            <div data-row-stop onClick={(e) => e.stopPropagation()}>
              <PayrollLineActions
                lineId={line.id}
                memberName={line.memberName}
                basicPaise={line.basicPaise}
                bonusPaise={line.bonusPaise}
                commissionPaise={line.commissionPaise}
                advanceDeductedPaise={line.advanceDeductedPaise}
                openAdvancePaise={line.openAdvancePaise}
                adjustmentPaise={line.adjustmentPaise}
                adjustmentNote={line.adjustmentNote}
                netPaise={line.netPaise}
                status={line.status}
                locale={locale}
              />
            </div>
          );
        },
      },
    ],
    [t, locale],
  );

  return (
    <div className="space-y-6">
      <DataTable
        columns={lineColumns}
        data={lines}
        defaultPageSize={10}
        toolbar={
          <PayrollFilters
            yearMonth={props.yearMonth}
            status={props.status}
            showStatus
            showTabs
            allowAllMonths
            activeTab="payroll"
          />
        }
        empty={
          <EmptyState
            icon={IndianRupee}
            title={
              hasActiveFilters ? t("emptySearchTitle") : t("emptyListTitle")
            }
            description={
              hasActiveFilters
                ? t("emptySearchDescription")
                : t("emptyListDescription")
            }
            action={hasActiveFilters ? undefined : addPayroll}
          />
        }
        renderMobileCard={(row) => {
          const line = row.original;
          return (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/team/${line.userId}`}
                    className="font-semibold text-foreground hover:underline"
                  >
                    {line.memberName}
                  </Link>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {formatPeriodMonthYear(line.periodStart, locale)}
                  </p>
                  <p className="mt-0.5 text-sm tabular-nums text-muted-foreground">
                    {t("columns.netPay")}:{" "}
                    <span className="font-bold text-blue-700">
                      {formatRupees(line.netPaise, locale)}
                    </span>
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge
                    variant={line.status === "PAID" ? "success" : "warning"}
                  >
                    {line.status === "PAID" ? t("paid") : t("unpaid")}
                  </Badge>
                  {line.status === "PAID" && line.paidAt ? (
                    <span className="text-xs text-muted-foreground">
                      {formatPaidOn(line.paidAt, locale)}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/50 px-3 py-2.5 text-sm">
                <div>
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {t("columns.basic")}
                  </p>
                  <p className="mt-0.5 font-bold tabular-nums text-slate-900">
                    {formatRupees(line.basicPaise, locale)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {t("advanceShort")}
                  </p>
                  {line.advanceDeductedPaise > 0 ? (
                    <p className="mt-0.5 font-bold tabular-nums text-amber-700">
                      {formatRupees(line.advanceDeductedPaise, locale)}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-muted-foreground">
                      {t("rowAdvanceNone")}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {t("adjustmentShort")}
                  </p>
                  <p
                    className={
                      line.adjustmentPaise > 0
                        ? "mt-0.5 font-bold tabular-nums text-emerald-700"
                        : line.adjustmentPaise < 0
                          ? "mt-0.5 font-bold tabular-nums text-red-600"
                          : "mt-0.5 font-bold tabular-nums text-slate-700"
                    }
                  >
                    {formatRupees(line.adjustmentPaise, locale)}
                  </p>
                </div>
              </div>
              <div className="border-t border-border pt-3">
                <PayrollLineActions
                  lineId={line.id}
                  memberName={line.memberName}
                  basicPaise={line.basicPaise}
                  bonusPaise={line.bonusPaise}
                  commissionPaise={line.commissionPaise}
                  advanceDeductedPaise={line.advanceDeductedPaise}
                  openAdvancePaise={line.openAdvancePaise}
                  adjustmentPaise={line.adjustmentPaise}
                  adjustmentNote={line.adjustmentNote}
                  netPaise={line.netPaise}
                  status={line.status}
                  locale={locale}
                />
              </div>
            </div>
          );
        }}
      />
    </div>
  );
}

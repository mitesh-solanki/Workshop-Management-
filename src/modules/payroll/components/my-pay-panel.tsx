"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { HandCoins, Wallet } from "lucide-react";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { formatRupees, type Paise } from "@/lib/money";
import { formatPeriodMonthYear } from "@/modules/payroll/date";
import { MyPayFilters } from "@/modules/payroll/components/my-pay-filters";
import type { MyPayTab } from "@/modules/payroll/components/my-pay-tabs";

export type MyPayLineSummary = {
  id: string;
  basicPaise: number;
  advanceDeductedPaise: number;
  adjustmentPaise: number;
  netPaise: number;
  status: "DRAFT" | "PAID";
  paidAt: string | null;
  periodStart: string;
  periodEnd: string;
};

export type MyPayAdvanceSummary = {
  id: string;
  amountPaise: number;
  remainingPaise: number;
  givenOn: string;
  method: "CASH" | "UPI" | "CARD" | "MIXED";
  note: string | null;
  status: "pending" | "partial" | "recovered";
};

type Props = {
  activeTab: MyPayTab;
  yearMonth: string;
  lines: MyPayLineSummary[];
  advances: MyPayAdvanceSummary[];
};

function yearMonthKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function formatDay(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function MyPayPanel({
  activeTab,
  yearMonth,
  lines,
  advances,
}: Props) {
  const t = useTranslations("myPay");
  const tp = useTranslations("payroll");
  const locale = useLocale();
  const hasFilters = yearMonth !== "all";

  const salaryRows = useMemo(() => {
    return lines.filter((line) => {
      if (yearMonth !== "all" && yearMonthKey(line.periodStart) !== yearMonth) {
        return false;
      }
      return true;
    });
  }, [lines, yearMonth]);

  const advanceRows = useMemo(() => {
    return advances.filter((advance) => {
      if (yearMonth !== "all" && yearMonthKey(advance.givenOn) !== yearMonth) {
        return false;
      }
      return true;
    });
  }, [advances, yearMonth]);

  const salaryColumns = useMemo<ColumnDef<MyPayLineSummary>[]>(
    () => [
      {
        id: "period",
        accessorFn: (row) => row.periodStart,
        header: tp("columns.period"),
        meta: { className: "w-1/5 whitespace-nowrap" },
        cell: ({ row }) => (
          <span className="font-medium whitespace-nowrap">
            {formatPeriodMonthYear(row.original.periodStart, locale)}
          </span>
        ),
      },
      {
        accessorKey: "basicPaise",
        header: tp("columns.basic"),
        meta: { className: "w-1/5 whitespace-nowrap" },
        cell: ({ row }) => (
          <span className="tabular-nums whitespace-nowrap">
            {formatRupees(row.original.basicPaise as Paise, locale)}
          </span>
        ),
      },
      {
        accessorKey: "advanceDeductedPaise",
        header: tp("advanceShort"),
        meta: { className: "w-1/5 whitespace-nowrap" },
        cell: ({ row }) => (
          <span className="tabular-nums whitespace-nowrap text-amber-700">
            {formatRupees(row.original.advanceDeductedPaise as Paise, locale)}
          </span>
        ),
      },
      {
        accessorKey: "netPaise",
        header: tp("columns.net"),
        meta: { className: "w-1/5 whitespace-nowrap" },
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums whitespace-nowrap text-blue-700">
            {formatRupees(row.original.netPaise as Paise, locale)}
          </span>
        ),
      },
      {
        id: "paidOn",
        accessorFn: (row) => row.paidAt,
        header: tp("paidOn"),
        meta: { className: "w-1/5 whitespace-nowrap" },
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            {row.original.paidAt
              ? formatDay(row.original.paidAt, locale)
              : "—"}
          </span>
        ),
      },
    ],
    [locale, tp],
  );

  const advanceColumns = useMemo<ColumnDef<MyPayAdvanceSummary>[]>(
    () => [
      {
        accessorKey: "givenOn",
        header: tp("givenOn"),
        meta: { className: "w-1/4 whitespace-nowrap" },
        cell: ({ row }) => (
          <span className="font-medium whitespace-nowrap">
            {formatDay(row.original.givenOn, locale)}
          </span>
        ),
      },
      {
        accessorKey: "amountPaise",
        header: tp("amount"),
        meta: { className: "w-1/4 whitespace-nowrap" },
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums whitespace-nowrap">
            {formatRupees(row.original.amountPaise as Paise, locale)}
          </span>
        ),
      },
      {
        accessorKey: "method",
        header: tp("paymentMethod"),
        meta: { className: "w-1/4 whitespace-nowrap" },
        cell: ({ row }) => tp(`methods.${row.original.method}`),
      },
      {
        accessorKey: "note",
        header: tp("note"),
        meta: { className: "w-1/4 whitespace-normal" },
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.note?.trim() || "—"}
          </span>
        ),
      },
    ],
    [locale, tp],
  );

  const toolbar = (
    <MyPayFilters activeTab={activeTab} yearMonth={yearMonth} />
  );

  if (activeTab === "salary") {
    return (
      <DataTable
        columns={salaryColumns}
        data={salaryRows}
        defaultPageSize={10}
        tableClassName="table-fixed"
        toolbar={toolbar}
        empty={
          <EmptyState
            icon={Wallet}
            title={hasFilters ? t("emptySearchTitle") : t("emptyTitle")}
            description={
              hasFilters
                ? t("emptySearchDescription")
                : t("emptyDescription")
            }
          />
        }
        renderMobileCard={(row) => {
          const line = row.original;
          return (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-foreground">
                  {formatPeriodMonthYear(line.periodStart, locale)}
                </p>
                <p className="shrink-0 font-semibold tabular-nums text-blue-700">
                  {formatRupees(line.netPaise as Paise, locale)}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/50 px-3 py-2.5 text-sm">
                <div>
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {tp("columns.basic")}
                  </p>
                  <p className="mt-0.5 font-medium tabular-nums">
                    {formatRupees(line.basicPaise as Paise, locale)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {tp("advanceShort")}
                  </p>
                  <p className="mt-0.5 font-medium tabular-nums text-amber-700">
                    {formatRupees(line.advanceDeductedPaise as Paise, locale)}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {tp("paidOn")}
                  </p>
                  <p className="mt-0.5 font-medium">
                    {line.paidAt ? formatDay(line.paidAt, locale) : "—"}
                  </p>
                </div>
              </div>
            </div>
          );
        }}
      />
    );
  }

  return (
    <DataTable
      columns={advanceColumns}
      data={advanceRows}
      defaultPageSize={10}
      tableClassName="table-fixed"
      toolbar={toolbar}
      empty={
        <EmptyState
          icon={HandCoins}
          title={
            hasFilters ? t("emptySearchTitle") : t("emptyAdvancesTitle")
          }
          description={
            hasFilters
              ? t("emptySearchDescription")
              : t("emptyAdvancesDescription")
          }
        />
      }
      renderMobileCard={(row) => {
        const advance = row.original;
        return (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-foreground">
                {formatDay(advance.givenOn, locale)}
              </p>
              <p className="shrink-0 font-semibold tabular-nums">
                {formatRupees(advance.amountPaise as Paise, locale)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/50 px-3 py-2.5 text-sm">
              <div>
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {tp("paymentMethod")}
                </p>
                <p className="mt-0.5 font-medium">
                  {tp(`methods.${advance.method}`)}
                </p>
              </div>
              {advance.note?.trim() ? (
                <div className="col-span-2">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {tp("note")}
                  </p>
                  <p className="mt-0.5 text-muted-foreground">{advance.note}</p>
                </div>
              ) : null}
            </div>
          </div>
        );
      }}
    />
  );
}

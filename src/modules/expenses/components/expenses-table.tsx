"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { formatRupees } from "@/lib/money";
import { ExpenseRowActions } from "@/modules/expenses/components/expense-row-actions";
import { ExpenseSearch } from "@/modules/expenses/components/expense-search";
import type {
  ExpenseMethod,
  ExpenseStatus,
} from "@/modules/expenses/schema";

export type ExpenseTableRow = {
  id: string;
  amountPaise: number;
  spentAt: Date | string;
  status: ExpenseStatus;
  method: ExpenseMethod | null;
  category: string;
  note: string | null;
};

type Props = {
  expenses: ExpenseTableRow[];
  page: number;
  pageSize: number;
  total: number;
  empty: React.ReactNode;
  canWrite?: boolean;
  usedCategories?: readonly string[];
};

function toDateInput(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}

function formatSpentAt(value: Date | string, locale: string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function ExpensesTable({
  expenses,
  page,
  pageSize,
  total,
  empty,
  canWrite = false,
  usedCategories = [],
}: Props) {
  const t = useTranslations("expenses");
  const locale = useLocale();

  const columns = useMemo<ColumnDef<ExpenseTableRow>[]>(
    () => [
      {
        accessorKey: "spentAt",
        header: t("columns.date"),
        cell: ({ row }) => (
          <span className="tabular-nums text-foreground">
            {formatSpentAt(row.original.spentAt, locale)}
          </span>
        ),
      },
      {
        accessorKey: "category",
        header: t("columns.category"),
        cell: ({ row }) => (
          <Badge variant="secondary">{row.original.category}</Badge>
        ),
      },
      {
        accessorKey: "amountPaise",
        header: t("columns.amount"),
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums text-foreground">
            {formatRupees(row.original.amountPaise, locale)}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: t("columns.status"),
        cell: ({ row }) => (
          <div className="flex flex-col items-start gap-1">
            <Badge
              variant={
                row.original.status === "PAID" ? "success" : "warning"
              }
            >
              {t(`statuses.${row.original.status}`)}
            </Badge>
            {row.original.status === "PAID" ? (
              <span className="text-xs tabular-nums text-muted-foreground">
                {t("paidOnDate", {
                  date: formatSpentAt(row.original.spentAt, locale),
                })}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "method",
        header: t("columns.method"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.method
              ? t(`methods.${row.original.method}`)
              : "—"}
          </span>
        ),
      },
      {
        accessorKey: "note",
        header: t("columns.note"),
        meta: {
          className:
            "max-w-[12rem] whitespace-normal sm:max-w-[16rem] lg:max-w-[20rem]",
        },
        cell: ({ row }) => (
          <span
            className="line-clamp-2 break-words text-muted-foreground"
            title={row.original.note?.trim() || undefined}
          >
            {row.original.note?.trim() ? row.original.note : "—"}
          </span>
        ),
      },
      {
        id: "actions",
        header: t("actions"),
        meta: { className: "w-[1%] whitespace-nowrap text-right" },
        cell: ({ row }) => (
          <ExpenseRowActions
            expense={{
              id: row.original.id,
              amountPaise: row.original.amountPaise,
              spentAtInput: toDateInput(row.original.spentAt),
              status: row.original.status,
              method: row.original.method,
              category: row.original.category,
              note: row.original.note,
            }}
            canWrite={canWrite}
            usedCategories={usedCategories}
          />
        ),
      },
    ],
    [t, locale, canWrite, usedCategories],
  );

  return (
    <DataTable
      columns={columns}
      data={expenses}
      empty={empty}
      defaultPageSize={10}
      toolbar={<ExpenseSearch />}
      pagination={{
        pageIndex: Math.max(0, page - 1),
        pageSize,
        rowCount: total,
      }}
      renderMobileCard={(row) => {
        const expense = row.original;
        return (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="text-base font-semibold tabular-nums text-foreground">
                  {formatRupees(expense.amountPaise, locale)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatSpentAt(expense.spentAt, locale)}
                </p>
              </div>
              <ExpenseRowActions
                expense={{
                  id: expense.id,
                  amountPaise: expense.amountPaise,
                  spentAtInput: toDateInput(expense.spentAt),
                  status: expense.status,
                  method: expense.method,
                  category: expense.category,
                  note: expense.note,
                }}
                canWrite={canWrite}
                usedCategories={usedCategories}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{expense.category}</Badge>
              <Badge
                variant={expense.status === "PAID" ? "success" : "warning"}
              >
                {t(`statuses.${expense.status}`)}
              </Badge>
              {expense.status === "PAID" ? (
                <span className="text-sm tabular-nums text-muted-foreground">
                  {t("paidOnDate", {
                    date: formatSpentAt(expense.spentAt, locale),
                  })}
                </span>
              ) : null}
              {expense.method ? (
                <span className="text-sm text-muted-foreground">
                  {t(`methods.${expense.method}`)}
                </span>
              ) : null}
            </div>
            {expense.note?.trim() ? (
              <p className="text-sm text-muted-foreground">{expense.note}</p>
            ) : null}
          </div>
        );
      }}
    />
  );
}

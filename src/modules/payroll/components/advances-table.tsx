"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { HandCoins } from "lucide-react";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { formatRupees } from "@/lib/money";
import { AdvanceRowActions } from "@/modules/payroll/components/advance-row-actions";
import { MoneyEntryModal } from "@/modules/payroll/components/money-entry-modal";
import { PayrollFilters } from "@/modules/payroll/components/payroll-filters";

type MemberOption = { id: string; label: string };

type AdvanceRow = {
  id: string;
  userId: string;
  memberName: string;
  amountPaise: number;
  remainingPaise: number;
  recoveredPaise: number;
  givenOn: Date | string;
  method: "CASH" | "UPI" | "CARD" | "MIXED";
  note: string | null;
  status: "pending" | "partial" | "recovered";
};

type Props = {
  yearMonth: string;
  searchQuery: string;
  members: MemberOption[];
  advances: AdvanceRow[];
};

function formatDay(value: Date | string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function AdvancesTable({
  yearMonth,
  searchQuery,
  members,
  advances,
}: Props) {
  const t = useTranslations("payroll");
  const locale = useLocale();
  const q = searchQuery.trim().toLowerCase();
  const rows = useMemo(
    () =>
      advances.filter((row) =>
        q ? row.memberName.toLowerCase().includes(q) : true,
      ),
    [advances, q],
  );
  const hasFilters = Boolean(q);
  const giveAdvance = (
    <MoneyEntryModal kind="advance" members={members} size="sm" />
  );

  const columns = useMemo<ColumnDef<AdvanceRow>[]>(
    () => [
      {
        accessorKey: "memberName",
        header: t("columns.member"),
        cell: ({ row }) => (
          <Link
            href={`/team/${row.original.userId}`}
            className="font-medium text-foreground hover:underline"
          >
            {row.original.memberName}
          </Link>
        ),
      },
      {
        accessorKey: "amountPaise",
        header: t("amount"),
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums">
            {formatRupees(row.original.amountPaise, locale)}
          </span>
        ),
      },
      {
        accessorKey: "givenOn",
        header: t("givenOn"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatDay(row.original.givenOn, locale)}
          </span>
        ),
      },
      {
        accessorKey: "method",
        header: t("paymentMethod"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {t(`methods.${row.original.method}`)}
          </span>
        ),
      },
      {
        accessorKey: "note",
        header: t("note"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.note?.trim() || "—"}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => (
          <span className="block text-right">{t("columns.actions")}</span>
        ),
        cell: ({ row }) => <AdvanceRowActions advance={row.original} />,
      },
    ],
    [t, locale],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      defaultPageSize={10}
      toolbar={
        <PayrollFilters
          yearMonth={yearMonth}
          showTabs
          activeTab="advances"
        />
      }
      empty={
        <EmptyState
          icon={HandCoins}
          title={hasFilters ? t("emptySearchTitle") : t("advancesEmptyTitle")}
          description={
            hasFilters
              ? t("emptySearchDescription")
              : t("advancesEmptyDescription")
          }
          action={hasFilters ? undefined : giveAdvance}
        />
      }
      renderMobileCard={(row) => {
        const item = row.original;
        return (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link
                  href={`/team/${item.userId}`}
                  className="font-semibold text-foreground hover:underline"
                >
                  {item.memberName}
                </Link>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {formatDay(item.givenOn, locale)}
                </p>
              </div>
              <AdvanceRowActions advance={item} />
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/50 px-3 py-2.5 text-sm">
              <div>
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {t("amount")}
                </p>
                <p className="mt-0.5 font-semibold tabular-nums">
                  {formatRupees(item.amountPaise, locale)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {t("paymentMethod")}
                </p>
                <p className="mt-0.5 text-muted-foreground">
                  {t(`methods.${item.method}`)}
                </p>
              </div>
              {item.note?.trim() ? (
                <div className="col-span-2">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {t("note")}
                  </p>
                  <p className="mt-0.5 text-muted-foreground">{item.note}</p>
                </div>
              ) : null}
            </div>
          </div>
        );
      }}
    />
  );
}

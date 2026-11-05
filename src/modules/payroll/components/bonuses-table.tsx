"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Gift } from "lucide-react";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { formatRupees } from "@/lib/money";
import { BonusRowActions } from "@/modules/payroll/components/bonus-row-actions";
import { MoneyEntryModal } from "@/modules/payroll/components/money-entry-modal";
import { PayrollFilters } from "@/modules/payroll/components/payroll-filters";

type MemberOption = { id: string; label: string };

type BonusRow = {
  id: string;
  userId: string;
  memberName: string;
  amountPaise: number;
  givenOn: Date | string;
  method: "CASH" | "UPI" | "CARD" | "MIXED";
  note: string | null;
  inclusion: "pending" | "included" | "paid";
};

type Props = {
  yearMonth: string;
  searchQuery: string;
  members: MemberOption[];
  bonuses: BonusRow[];
};

function formatDay(value: Date | string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function BonusesTable({
  yearMonth,
  searchQuery,
  members,
  bonuses,
}: Props) {
  const t = useTranslations("payroll");
  const locale = useLocale();
  const q = searchQuery.trim().toLowerCase();
  const rows = useMemo(
    () =>
      bonuses.filter((row) =>
        q ? row.memberName.toLowerCase().includes(q) : true,
      ),
    [bonuses, q],
  );
  const hasFilters = Boolean(q);
  const giveBonus = (
    <MoneyEntryModal kind="bonus" members={members} size="sm" />
  );

  const columns = useMemo<ColumnDef<BonusRow>[]>(
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
        cell: ({ row }) => <BonusRowActions bonus={row.original} />,
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
          activeTab="bonuses"
        />
      }
      empty={
        <EmptyState
          icon={Gift}
          title={hasFilters ? t("emptySearchTitle") : t("noBonuses")}
          description={
            hasFilters
              ? t("emptySearchDescription")
              : t("bonusesEmptyDescription")
          }
          action={hasFilters ? undefined : giveBonus}
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
              <BonusRowActions bonus={item} />
            </div>
            <p className="text-base font-semibold tabular-nums">
              {formatRupees(item.amountPaise, locale)}
            </p>
            <p className="text-sm text-muted-foreground">
              {t(`methods.${item.method}`)}
              {item.note?.trim() ? ` · ${item.note.trim()}` : ""}
            </p>
          </div>
        );
      }}
    />
  );
}

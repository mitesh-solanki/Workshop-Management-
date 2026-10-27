"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { BayRowActions } from "@/modules/bays/components/bay-row-actions";
import { BaySearch } from "@/modules/bays/components/bay-search";

export type BayTableRow = {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: Date | string;
  openJobCount: number;
};

type BaysTableProps = {
  bays: BayTableRow[];
  page: number;
  pageSize: number;
  total: number;
  empty: React.ReactNode;
  canWrite?: boolean;
  toolbarActions?: React.ReactNode;
};

function formatCreatedAt(value: Date | string, locale: string) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function BaysTable({
  bays,
  page,
  pageSize,
  total,
  empty,
  canWrite = false,
  toolbarActions,
}: BaysTableProps) {
  const t = useTranslations("bays");
  const locale = useLocale();

  const columns = useMemo<ColumnDef<BayTableRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("columns.name"),
        cell: ({ row }) => (
          <span className="font-medium text-foreground">{row.original.name}</span>
        ),
      },
      {
        accessorKey: "openJobCount",
        header: t("columns.openJobs"),
        cell: ({ row }) => {
          const count = row.original.openJobCount;
          if (count <= 0) {
            return (
              <span className="text-muted-foreground">{t("openJobsEmpty")}</span>
            );
          }
          return (
            <Badge variant="warning">
              {t("openJobsCount", { count })}
            </Badge>
          );
        },
      },
      {
        accessorKey: "createdAt",
        header: t("columns.created"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatCreatedAt(row.original.createdAt, locale)}
          </span>
        ),
      },
      {
        id: "actions",
        header: t("actions"),
        meta: { className: "w-[1%] whitespace-nowrap" },
        cell: ({ row }) => (
          <BayRowActions
            bay={{ id: row.original.id, name: row.original.name }}
            canWrite={canWrite}
          />
        ),
      },
    ],
    [canWrite, locale, t],
  );

  return (
    <DataTable
      columns={columns}
      data={bays}
      empty={empty}
      defaultPageSize={10}
      toolbar={<BaySearch actions={toolbarActions} />}
      pagination={{
        pageIndex: Math.max(0, page - 1),
        pageSize,
        rowCount: total,
      }}
      renderMobileCard={(row) => {
        const bay = row.original;
        return (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="truncate text-base font-semibold text-foreground">
                  {bay.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("columns.created")}: {formatCreatedAt(bay.createdAt, locale)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("columns.openJobs")}:{" "}
                  {bay.openJobCount > 0
                    ? t("openJobsCount", { count: bay.openJobCount })
                    : t("openJobsEmpty")}
                </p>
              </div>
              <BayRowActions
                bay={{ id: bay.id, name: bay.name }}
                canWrite={canWrite}
              />
            </div>
          </div>
        );
      }}
    />
  );
}

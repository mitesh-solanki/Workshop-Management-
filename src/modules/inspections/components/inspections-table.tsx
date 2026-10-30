"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import type { InspectionApprovalStatus } from "@/modules/inspections/approval-status";
import { InspectionApprovalBadge } from "@/modules/inspections/components/inspection-approval-badge";
import { InspectionRowActions } from "@/modules/inspections/components/inspection-row-actions";
import { InspectionSearch } from "@/modules/inspections/components/inspection-search";

export type InspectionTableRow = {
  id: string;
  createdAt: Date | string;
  expectedCompletion: Date | string | null;
  customer: { id: string; name: string };
  vehicle: {
    id: string;
    registrationNumber: string;
    make: string;
    model: string;
  };
  serviceOrderId: string | null;
  itemCount: number;
  approvalStatus: InspectionApprovalStatus;
};

type Props = {
  inspections: InspectionTableRow[];
  page: number;
  pageSize: number;
  total: number;
  empty: ReactNode;
  toolbarActions?: ReactNode;
};

function formatListDate(value: Date | string | null | undefined, locale: string) {
  if (value == null || value === "") return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatListDateTime(
  value: Date | string | null | undefined,
  locale: string,
) {
  if (value == null || value === "") return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function InspectionsTable({
  inspections,
  page,
  pageSize,
  total,
  empty,
  toolbarActions,
}: Props) {
  const t = useTranslations("inspections");
  const locale = useLocale();

  const columns = useMemo<ColumnDef<InspectionTableRow>[]>(
    () => [
      {
        accessorKey: "customer",
        header: t("columns.customer"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.customer.name}
          </span>
        ),
      },
      {
        accessorKey: "vehicle",
        header: t("columns.vehicle"),
        cell: ({ row }) => (
          <Link
            href={`/inspections/${row.original.id}`}
            className="font-medium tracking-wide text-foreground underline-offset-4 hover:underline"
          >
            {row.original.vehicle.registrationNumber}
          </Link>
        ),
      },
      {
        id: "approvalStatus",
        accessorKey: "approvalStatus",
        header: t("columns.approval"),
        cell: ({ row }) => (
          <InspectionApprovalBadge status={row.original.approvalStatus} />
        ),
      },
      {
        accessorKey: "createdAt",
        header: t("columns.createdOn"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {formatListDate(row.original.createdAt, locale)}
          </span>
        ),
      },
      {
        id: "expectedCompletion",
        accessorKey: "expectedCompletion",
        header: t("columns.expectedCompletion"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {formatListDateTime(row.original.expectedCompletion, locale)}
          </span>
        ),
      },
      {
        id: "actions",
        header: t("columns.actions"),
        meta: { className: "w-[1%] whitespace-nowrap" },
        cell: ({ row }) => (
          <InspectionRowActions
            inspectionId={row.original.id}
            registrationNumber={row.original.vehicle.registrationNumber}
          />
        ),
      },
    ],
    [locale, t],
  );

  return (
    <DataTable
      columns={columns}
      data={inspections}
      empty={empty}
      toolbar={<InspectionSearch actions={toolbarActions} />}
      getRowHref={(row) => `/inspections/${row.id}`}
      pagination={{
        pageIndex: Math.max(0, page - 1),
        pageSize,
        rowCount: total,
      }}
      renderMobileCard={(row) => {
        const item = row.original;
        return (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <p className="truncate text-base font-semibold text-foreground">
                {item.customer.name}
              </p>
              <p className="truncate text-sm font-medium tracking-wide text-foreground">
                {item.vehicle.registrationNumber}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("columns.createdOn")}:{" "}
                {formatListDate(item.createdAt, locale)}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("columns.expectedCompletion")}:{" "}
                {formatListDateTime(item.expectedCompletion, locale)}
              </p>
              <InspectionApprovalBadge status={item.approvalStatus} />
            </div>
            <InspectionRowActions
              inspectionId={item.id}
              registrationNumber={item.vehicle.registrationNumber}
            />
          </div>
        );
      }}
    />
  );
}

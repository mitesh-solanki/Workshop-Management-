"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ClipboardList } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InspectionApprovalBadge } from "@/modules/inspections/components/inspection-approval-badge";
import type { InspectionTableRow } from "@/modules/inspections/components/inspections-table";
import { InspectionRowActions } from "@/modules/inspections/components/inspection-row-actions";

type Props = {
  inspections: InspectionTableRow[];
  emptyTitle: string;
  emptyBody: string;
  emptyAction?: ReactNode;
  showCustomer?: boolean;
  showRegistration?: boolean;
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

export function InspectionsList({
  inspections,
  emptyTitle,
  emptyBody,
  emptyAction,
  showCustomer = false,
  showRegistration = true,
}: Props) {
  const t = useTranslations("inspections");
  const locale = useLocale();

  if (inspections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-5 py-12 text-center sm:px-6">
        <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <ClipboardList className="size-5" aria-hidden />
        </span>
        <div className="space-y-0.5">
          <p className="text-section-title text-slate-900">{emptyTitle}</p>
          <p className="max-w-md text-body text-slate-600">{emptyBody}</p>
        </div>
        {emptyAction}
      </div>
    );
  }

  return (
    <>
      <ul className="space-y-3 p-3 md:hidden">
        {inspections.map((row) => (
          <li
            key={row.id}
            className="rounded-xl border border-border bg-card p-3.5 shadow-sm"
          >
            <Link
              href={`/inspections/${row.id}`}
              className="min-w-0 flex-1 space-y-1"
            >
              {showCustomer ? (
                <p className="truncate text-sm font-semibold text-foreground">
                  {row.customer.name}
                </p>
              ) : null}
              {showRegistration ? (
                <p className="truncate text-sm font-semibold tracking-wide text-foreground">
                  {row.vehicle.registrationNumber}
                </p>
              ) : null}
              <p className="text-caption text-muted-foreground">
                {t("columns.createdOn")}: {formatListDate(row.createdAt, locale)}
              </p>
              <p className="text-caption text-muted-foreground">
                {t("columns.expectedCompletion")}:{" "}
                {formatListDateTime(row.expectedCompletion, locale)}
              </p>
              <InspectionApprovalBadge status={row.approvalStatus} />
            </Link>
            <div className="mt-3 flex justify-end border-t border-border pt-3">
              <InspectionRowActions
                inspectionId={row.id}
                registrationNumber={row.vehicle.registrationNumber}
              />
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <Table>
          <TableHeader className="bg-slate-100 [&_tr]:border-border">
            <TableRow className="hover:bg-transparent">
              {showCustomer ? (
                <TableHead className="text-slate-700">
                  {t("columns.customer")}
                </TableHead>
              ) : null}
              {showRegistration ? (
                <TableHead className="text-slate-700">
                  {t("columns.vehicle")}
                </TableHead>
              ) : null}
              <TableHead className="text-slate-700">
                {t("columns.approval")}
              </TableHead>
              <TableHead className="whitespace-nowrap text-slate-700">
                {t("columns.createdOn")}
              </TableHead>
              <TableHead className="whitespace-nowrap text-slate-700">
                {t("columns.expectedCompletion")}
              </TableHead>
              <TableHead className="w-[1%] text-right text-slate-700">
                <span className="sr-only">{t("columns.actions")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inspections.map((row) => (
              <TableRow key={row.id} className="hover:bg-muted/50">
                {showCustomer ? (
                  <TableCell className="text-muted-foreground">
                    {row.customer.name}
                  </TableCell>
                ) : null}
                {showRegistration ? (
                  <TableCell className="whitespace-nowrap">
                    <Link
                      href={`/inspections/${row.id}`}
                      className="font-medium tracking-wide text-foreground"
                    >
                      {row.vehicle.registrationNumber}
                    </Link>
                  </TableCell>
                ) : null}
                <TableCell>
                  <InspectionApprovalBadge status={row.approvalStatus} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatListDate(row.createdAt, locale)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatListDateTime(row.expectedCompletion, locale)}
                </TableCell>
                <TableCell className="text-right">
                  <InspectionRowActions
                    inspectionId={row.id}
                    registrationNumber={row.vehicle.registrationNumber}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

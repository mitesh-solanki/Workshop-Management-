"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Wrench } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ServiceOrderStatus } from "@/lib/service-order-status";
import { JobCardRowActions } from "@/modules/service-orders/components/job-card-row-actions";

export type ServiceHistoryRow = {
  id: string;
  status: ServiceOrderStatus;
  complaint: string;
  createdAt: Date | string;
  expectedCompletion: Date | string | null;
  vehicle: {
    id: string;
    registrationNumber: string;
  };
};

function asDate(value: Date | string | null): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value: Date | null, locale: string, empty: string) {
  if (!value) return empty;
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(value);
}

type Props = {
  orders: ServiceHistoryRow[];
  locale: string;
  customerId: string;
  canWrite: boolean;
  emptyTitle: string;
  emptyBody: string;
  showRegistration: boolean;
  statusLabel: (status: ServiceOrderStatus) => string;
  emptyAction?: ReactNode;
};

export function ServiceHistoryList({
  orders,
  locale,
  customerId,
  canWrite,
  emptyTitle,
  emptyBody,
  showRegistration,
  statusLabel,
  emptyAction,
}: Props) {
  const t = useTranslations("orders");

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-5 py-12 text-center sm:px-6">
        <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Wrench className="size-5" aria-hidden />
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
        {orders.map((order) => {
          const created = asDate(order.createdAt);
          const label = showRegistration
            ? order.vehicle.registrationNumber
            : order.complaint;
          return (
            <li
              key={order.id}
              className="rounded-xl border border-border bg-card p-3.5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/orders/${order.id}`}
                  className="min-w-0 flex-1 space-y-1"
                >
                  {showRegistration ? (
                    <p className="truncate text-sm font-semibold tracking-wide text-foreground">
                      {order.vehicle.registrationNumber}
                    </p>
                  ) : null}
                  <p className="line-clamp-2 text-sm text-foreground">
                    {order.complaint}
                  </p>
                  <p className="text-caption text-muted-foreground">
                    {formatDate(created, locale, "—")}
                  </p>
                </Link>
                <StatusBadge
                  status={order.status}
                  label={statusLabel(order.status)}
                />
              </div>
              <div className="mt-3 flex justify-end border-t border-border pt-3">
                <JobCardRowActions
                  orderId={order.id}
                  customerId={customerId}
                  label={label}
                  canWrite={canWrite}
                  mode="view-delete"
                />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <Table>
          <TableHeader className="bg-slate-100 [&_tr]:border-border">
            <TableRow className="hover:bg-transparent">
              {showRegistration ? (
                <TableHead className="text-slate-700">
                  {t("columns.vehicle")}
                </TableHead>
              ) : null}
              <TableHead className="text-slate-700">
                {t("columns.complaint")}
              </TableHead>
              <TableHead className="whitespace-nowrap text-slate-700">
                {t("columns.date")}
              </TableHead>
              <TableHead className="text-slate-700">
                {t("columns.status")}
              </TableHead>
              <TableHead className="w-[1%] text-right text-slate-700">
                <span className="sr-only">{t("columns.actions")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => {
              const created = asDate(order.createdAt);
              const label = showRegistration
                ? order.vehicle.registrationNumber
                : order.complaint;
              return (
                <TableRow key={order.id} className="hover:bg-muted/50">
                  {showRegistration ? (
                    <TableCell className="whitespace-nowrap">
                      <Link
                        href={`/orders/${order.id}`}
                        className="font-medium tracking-wide text-foreground"
                      >
                        {order.vehicle.registrationNumber}
                      </Link>
                    </TableCell>
                  ) : null}
                  <TableCell className="max-w-[18rem]">
                    <Link
                      href={`/orders/${order.id}`}
                      className="line-clamp-2 text-foreground"
                    >
                      {order.complaint}
                    </Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDate(created, locale, "—")}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      status={order.status}
                      label={statusLabel(order.status)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <JobCardRowActions
                      orderId={order.id}
                      customerId={customerId}
                      label={label}
                      canWrite={canWrite}
                      mode="view-delete"
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

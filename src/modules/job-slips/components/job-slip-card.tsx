"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { formatRupees, type Paise } from "@/lib/money";
import {
  serviceOrderStatusOnDarkClass,
  type ServiceOrderStatus,
} from "@/lib/service-order-status";
import type { ServiceOrderStatusValue } from "@/modules/service-orders/schema";
import { formatTechniciansList } from "@/modules/service-orders/technicians";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type JobSlipCardData = {
  id: string;
  jobCardNumber: number;
  status: ServiceOrderStatusValue;
  needsPricing: boolean;
  complaint: string;
  bay: string | null;
  odometerIn: number | null;
  createdAt: string;
  expectedCompletion: string | null;
  vehicle: {
    registrationNumber: string;
    make: string;
    model: string;
  };
  customer: {
    name: string;
    phone: string;
    address: string | null;
  };
  technician: { id: string; name: string | null; email: string } | null;
  technicianAssignments: Array<{
    technicianId: string;
    technician: { id: string; name: string | null; email: string };
  }>;
  lines: Array<{
    id: string;
    type: "LABOUR" | "PART";
    description: string;
    quantity: number;
    unitPricePaise: number;
  }>;
  outsideLines: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPricePaise: number;
  }>;
  garage: {
    name: string;
    address: string | null;
  };
};

type Props = {
  slip: JobSlipCardData;
  /** When false, render a static slip (e.g. inside a dialog). Default true. */
  linked?: boolean;
};

function formatDate(value: string | null, locale: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function Field({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[10px] font-semibold tracking-[0.08em] text-stone-500 uppercase sm:text-[11px]">
        {label}
      </p>
      <p className="mt-0.5 text-[13px] font-medium text-stone-900 sm:text-[14px]">
        {trimmed}
      </p>
    </div>
  );
}

function SlipTable({
  title,
  columns,
  rows,
  locale,
}: {
  title: string;
  columns: { key: string; label: string; align?: "left" | "right" | "center" }[];
  rows: Array<Record<string, string>>;
  locale: string;
}) {
  if (rows.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-[12px] font-bold tracking-[0.06em] text-stone-800 uppercase sm:text-[13px]">
        {title}
      </h3>
      <div className="overflow-hidden rounded-lg border border-stone-300 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[320px] border-collapse text-left text-[13px] text-stone-900">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50">
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={cn(
                      "px-2.5 py-2 text-[11px] font-semibold tracking-[0.06em] text-stone-500 uppercase",
                      column.align === "right" && "text-right",
                      column.align === "center" && "text-center",
                    )}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={`${row.id ?? index}`}
                  className="border-b border-stone-200 last:border-b-0 odd:bg-white even:bg-stone-50/60"
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        "px-2.5 py-2.5 align-top font-semibold text-stone-900",
                        column.align === "right" && "text-right tabular-nums",
                        column.align === "center" && "text-center tabular-nums",
                      )}
                      lang={locale}
                    >
                      {row[column.key] || "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function JobSlipCard({ slip, linked = true }: Props) {
  const t = useTranslations("jobSlips");
  const locale = useLocale();
  const vehicleLabel = `${slip.vehicle.make} ${slip.vehicle.model}`.trim();
  const technicianLabel = formatTechniciansList(slip, "").trim();
  const moneyLocale = "en-IN";
  const openLabel = `${slip.vehicle.registrationNumber} · ${slip.customer.name}`;

  const labourAndPartsRows = slip.lines.map((line) => ({
    id: line.id,
    description: line.description,
    qty:
      line.type === "PART"
        ? String(line.quantity)
        : line.quantity > 1
          ? String(line.quantity)
          : "—",
    price:
      line.unitPricePaise > 0
        ? formatRupees(line.unitPricePaise as Paise, moneyLocale)
        : "—",
  }));

  const outsideRows = slip.outsideLines.map((line) => ({
    id: line.id,
    description: line.description,
    price:
      line.unitPricePaise > 0
        ? formatRupees(line.unitPricePaise as Paise, moneyLocale)
        : "—",
  }));

  return (
    <article
      className={cn(
        "relative flex flex-col overflow-hidden rounded-xl border border-stone-300 bg-[#faf8f5] shadow-sm",
        linked && "transition-shadow hover:border-stone-400 hover:shadow-md",
      )}
    >
      {linked ? (
        <Link
          href={`/orders/${slip.id}`}
          prefetch={false}
          aria-label={openLabel}
          className="absolute inset-0 z-10 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-500 focus-visible:ring-offset-2"
        />
      ) : null}

      <header className="relative z-0 border-b border-stone-700 bg-stone-900 px-3.5 py-3 text-stone-50 sm:px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[18px] leading-tight font-bold tracking-wide sm:text-[20px]">
              {slip.garage.name}
            </p>
            {slip.garage.address ? (
              <p className="mt-1 text-[12px] leading-snug text-stone-400">
                {slip.garage.address}
              </p>
            ) : null}
            <p className="mt-2 font-mono text-[13px] font-semibold tracking-wide text-stone-200 sm:text-[14px]">
              {t("jobCardNumber", { number: slip.jobCardNumber })}
            </p>
          </div>
          <div
            className={cn(
              "relative z-20 flex shrink-0 flex-col items-end gap-1.5",
              linked && "pointer-events-none",
            )}
          >
            <Badge
              variant="outline"
              className={cn(
                "font-semibold",
                serviceOrderStatusOnDarkClass[slip.status as ServiceOrderStatus],
              )}
            >
              {t(`statuses.${slip.status}`)}
            </Badge>
            {slip.needsPricing ? (
              <Badge
                variant="warning"
                className="border-transparent bg-amber-200 font-semibold text-amber-950"
              >
                {t("needsPricing")}
              </Badge>
            ) : null}
          </div>
        </div>
      </header>

      <div className="relative z-0 flex flex-col gap-6 px-3.5 py-4 text-stone-900 sm:gap-7 sm:px-4 sm:py-5">
        <div className="grid grid-cols-2 gap-x-3 gap-y-3.5 sm:grid-cols-3 sm:gap-y-4">
          <Field
            label={t("fields.date")}
            value={formatDate(slip.createdAt, locale)}
          />
          <Field label={t("fields.name")} value={slip.customer.name} />
          <Field label={t("fields.phone")} value={slip.customer.phone} />
          <Field
            label={t("fields.address")}
            value={slip.customer.address?.trim() ?? ""}
            className="col-span-2 sm:col-span-3"
          />
          <Field label={t("fields.vehicleType")} value={vehicleLabel} />
          <Field
            label={t("fields.registration")}
            value={slip.vehicle.registrationNumber}
          />
          <Field
            label={t("fields.kmsCovered")}
            value={
              slip.odometerIn != null
                ? new Intl.NumberFormat(locale).format(slip.odometerIn)
                : ""
            }
          />
          <Field label={t("fields.mechanic")} value={technicianLabel} />
          <Field
            label={t("fields.deliveryDate")}
            value={formatDate(slip.expectedCompletion, locale)}
          />
        </div>

        <div className="flex flex-col gap-6 sm:gap-7">
          <SlipTable
            title={t("labourAndParts")}
            columns={[
              { key: "description", label: t("columns.description") },
              { key: "qty", label: t("columns.qty"), align: "center" },
              { key: "price", label: t("columns.price"), align: "right" },
            ]}
            rows={labourAndPartsRows}
            locale={locale}
          />

          <SlipTable
            title={t("outsideWork")}
            columns={[
              { key: "description", label: t("columns.description") },
              { key: "price", label: t("columns.price"), align: "right" },
            ]}
            rows={outsideRows}
            locale={locale}
          />
        </div>
      </div>
    </article>
  );
}

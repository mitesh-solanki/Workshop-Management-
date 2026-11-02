"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import {
  serviceOrderStatusOnDarkClass,
  type ServiceOrderStatus,
} from "@/lib/service-order-status";
import type { ServiceOrderStatusValue } from "@/modules/service-orders/schema";
import { formatTechniciansList } from "@/modules/service-orders/technicians";
import { cn } from "@/lib/utils";

export type JobSlipCardData = {
  id: string;
  status: ServiceOrderStatusValue;
  needsPricing: boolean;
  complaint: string;
  bay: string | null;
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
  }>;
};

type Props = {
  slip: JobSlipCardData;
};

function formatWhen(value: string | null, locale: string, empty: string) {
  if (!value) return empty;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return empty;
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function JobSlipCard({ slip }: Props) {
  const t = useTranslations("jobSlips");
  const locale = useLocale();
  const vehicleLabel = `${slip.vehicle.make} ${slip.vehicle.model}`.trim();
  const technicianLabel = formatTechniciansList(slip, "").trim();
  const complaint = slip.complaint.trim();
  const workStation = slip.bay?.trim() || null;
  const dueLabel = formatWhen(slip.expectedCompletion, locale, "");
  const metaItems = [
    workStation
      ? { key: "workStation", label: t("workStation"), value: workStation }
      : null,
    technicianLabel
      ? { key: "technician", label: t("technician"), value: technicianLabel }
      : null,
    {
      key: "received",
      label: t("received"),
      value: formatWhen(slip.createdAt, locale, t("dueNone")),
    },
    dueLabel ? { key: "due", label: t("due"), value: dueLabel } : null,
  ].filter((item): item is { key: string; label: string; value: string } =>
    Boolean(item),
  );

  return (
    <Link
      href={`/orders/${slip.id}`}
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm",
        "ring-1 ring-slate-900/5 transition-shadow hover:shadow-md",
        "focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none",
      )}
    >
      <div className="flex items-start justify-between gap-3 border-b-2 border-slate-900 bg-slate-900 px-3.5 py-3">
        <div className="min-w-0 text-left">
          <p className="font-mono text-[18px] leading-tight font-bold tracking-wide break-all text-white sm:text-[20px]">
            {slip.vehicle.registrationNumber}
          </p>
          {vehicleLabel ? (
            <p className="mt-1 text-[12px] text-slate-300">{vehicleLabel}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
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
              className="border-transparent bg-orange-200 font-semibold text-orange-950"
            >
              {t("needsPricing")}
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-3 px-4 py-3.5">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
            {t("customer")}
          </p>
          <p className="truncate text-[17px] font-semibold leading-snug text-slate-900 sm:text-[18px]">
            {slip.customer.name}
          </p>
          <p className="text-[12px] leading-snug tabular-nums text-slate-500">
            {slip.customer.phone}
          </p>
        </div>

        {complaint ? (
          <div className="space-y-1">
            <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
              {t("complaint")}
            </p>
            <p className="text-[15px] leading-snug font-medium text-slate-800 sm:text-[16px]">
              {complaint}
            </p>
          </div>
        ) : null}

        {metaItems.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-3 border-t border-dashed border-slate-200 pt-3 text-[14px]">
            {metaItems.map((item) => (
              <div key={item.key} className="min-w-0 space-y-1">
                <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                  {item.label}
                </p>
                <p className="truncate font-medium text-slate-900">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {slip.lines.length > 0 ? (
          <div className="space-y-1.5 border-t border-dashed border-slate-200 pt-3">
            <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
              {t("labourAndParts")}
            </p>
            <ul className="list-disc space-y-1.5 pl-5 marker:text-slate-700">
              {slip.lines.slice(0, 6).map((line) => (
                <li
                  key={line.id}
                  className="pl-0.5 text-[15px] leading-snug text-slate-800 sm:text-[16px]"
                >
                  <span className="break-words">
                    {line.description}
                    {line.type === "PART" ? (
                      <span className="ml-1 text-[12px] font-normal text-slate-500">
                        ({t("qtyShort", { count: line.quantity })})
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
              {slip.lines.length > 6 ? (
                <li className="list-none -ml-5 text-[13px] text-slate-500">
                  {t("moreLines", { count: slip.lines.length - 6 })}
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </div>
    </Link>
  );
}

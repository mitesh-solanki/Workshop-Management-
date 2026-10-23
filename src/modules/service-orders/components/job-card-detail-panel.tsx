"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePageDetailLabel } from "@/components/page-chrome";
import {
  Card,
  CardDescription,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatRupees, multiplyByQuantity } from "@/lib/money";
import type { ServiceOrderStatus } from "@/lib/service-order-status";
import { JobCardSectionNav } from "@/modules/service-orders/components/job-card-section-nav";
import {
  OrderLineForm,
  type OrderLinePartOption,
} from "@/modules/service-orders/components/order-line-form";
import { OrderTimeline } from "@/modules/service-orders/components/order-timeline";
import {
  datetimeLocalFromOrder,
  ServiceOrderForm,
} from "@/modules/service-orders/components/service-order-form";
import type { JobCardSection } from "@/modules/service-orders/job-card-sections";
import type { ServiceOrderStatusValue } from "@/modules/service-orders/schema";
import {
  jobCardSectionDomId,
  useJobCardSections,
} from "@/modules/service-orders/use-job-card-sections";

export type { JobCardSection };

type OrderLine = {
  id: string;
  type: string;
  description: string;
  quantity: number;
  unitPricePaise: number;
};

type TimelineEvent = {
  id: string;
  action: string;
  meta: unknown;
  createdAt: Date | string;
  actor: { id: string; name: string | null; email: string } | null;
};

type TechnicianOption = {
  id: string;
  name: string | null;
  email: string;
};

type OrderData = {
  id: string;
  status: ServiceOrderStatus;
  priority: string;
  complaint: string;
  requestedServices: string | null;
  odometerIn: number | null;
  expectedCompletion: Date | string | null;
  bay: string | null;
  technicianId: string | null;
  customerId: string;
  customer: { name: string };
  vehicle: { registrationNumber: string; make: string; model: string };
  technician: { name: string | null; email: string } | null;
  lines: OrderLine[];
};

type Props = {
  order: OrderData;
  timeline: TimelineEvent[];
  technicians: TechnicianOption[];
  canMutate: boolean;
  locale: string;
  initialSection?: JobCardSection;
  parts: OrderLinePartOption[];
  inspectionContent: ReactNode;
  estimateContent: ReactNode;
  billingContent: ReactNode;
  liveLinkContent: ReactNode;
};

function asDate(value: Date | string | null): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTime(value: Date | null, locale: string, empty: string) {
  if (!value) return empty;
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function SectionBlock({
  id,
  title,
  subtitle,
  sectionRef,
  children,
}: {
  id: JobCardSection;
  title: string;
  subtitle?: string;
  sectionRef: (node: HTMLElement | null) => void;
  children: ReactNode;
}) {
  return (
    <Card
      id={jobCardSectionDomId(id)}
      ref={sectionRef}
      className="min-w-0 scroll-mt-4 gap-0 overflow-visible py-0"
    >
      <div className="border-b border-border px-5 py-3.5 sm:px-6">
        <h2 className="text-section-title text-slate-900">{title}</h2>
        {subtitle ? (
          <CardDescription className="mt-0.5">{subtitle}</CardDescription>
        ) : null}
      </div>
      {children}
    </Card>
  );
}

export function JobCardDetailPanel({
  order,
  timeline,
  technicians,
  canMutate,
  locale,
  initialSection = "details",
  parts,
  inspectionContent,
  estimateContent,
  billingContent,
  liveLinkContent,
}: Props) {
  const t = useTranslations("orders");
  const tc = useTranslations("customers");
  const ti = useTranslations("inspections");
  const te = useTranslations("estimates");
  const tb = useTranslations("billing");
  const tl = useTranslations("liveLink");
  usePageDetailLabel(order.vehicle.registrationNumber);
  const { activeSection, scrollToSection, setSectionRef } = useJobCardSections({
    initialSection,
    syncUrl: true,
  });

  return (
    <div className="w-full space-y-4">
      <header className="flex flex-col gap-2 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-page-title text-slate-900">
            {order.vehicle.registrationNumber}
          </h1>
          <p className="mt-0.5 truncate text-sm text-slate-600">
            <Link
              href={`/customers/${order.customerId}`}
              className="text-teal-700 underline-offset-4 hover:underline"
            >
              {order.customer.name}
            </Link>
            <span className="text-slate-400"> · </span>
            <span>{`${order.vehicle.make} ${order.vehicle.model}`.trim()}</span>
          </p>
        </div>
        <StatusBadge
          status={order.status}
          label={t(`statuses.${order.status}`)}
        />
      </header>

      <div className="grid w-full items-start gap-4 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)]">
        <JobCardSectionNav
          section={activeSection}
          onSectionChange={scrollToSection}
        />

        <div className="flex min-w-0 flex-col gap-4">
          <SectionBlock
            id="details"
            title={t("details")}
            subtitle={t("detailsHint")}
            sectionRef={setSectionRef("details")}
          >
            <div className="space-y-6 px-5 py-5 sm:px-6">
              <ServiceOrderForm
                mode="edit"
                orderId={order.id}
                technicians={technicians}
                canEdit={canMutate}
                locked={{
                  customerName: order.customer.name,
                  registrationNumber: order.vehicle.registrationNumber,
                  vehicleLabel:
                    `${order.vehicle.make} ${order.vehicle.model}`.trim(),
                }}
                defaults={{
                  complaint: order.complaint,
                  requestedServices: order.requestedServices ?? "",
                  odometerIn: order.odometerIn,
                  expectedCompletion: datetimeLocalFromOrder(
                    order.expectedCompletion,
                  ),
                  technicianId: order.technicianId ?? "",
                  bay: order.bay ?? "",
                  priority: order.priority,
                  status: order.status as ServiceOrderStatusValue,
                }}
              />
            </div>
          </SectionBlock>

          <SectionBlock
            id="lines"
            title={t("lines")}
            subtitle={t("linesDescription")}
            sectionRef={setSectionRef("lines")}
          >
            <div className="space-y-5 px-5 py-5 sm:px-6">
              {order.lines.length === 0 ? (
                <p className="text-sm text-slate-600">{t("linesEmpty")}</p>
              ) : (
                <ul className="divide-y overflow-hidden rounded-lg border border-slate-200">
                  {order.lines.map((line) => {
                    const total = multiplyByQuantity(
                      line.unitPricePaise,
                      line.quantity,
                    );
                    const typeKey =
                      line.type === "PART" || line.type === "LABOUR"
                        ? line.type
                        : "LABOUR";
                    return (
                      <li key={line.id} className="space-y-0.5 px-3 py-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="min-w-0 text-sm font-medium text-slate-900">
                            {line.description}
                          </p>
                          <span className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">
                            {t(`lineTypes.${typeKey}`)}
                          </span>
                        </div>
                        <p className="text-caption text-slate-500">
                          {`${line.quantity} × ${formatRupees(line.unitPricePaise)} = ${formatRupees(total)}`}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
              {canMutate ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-4">
                  <p className="mb-3 text-sm font-medium text-slate-800">
                    {t("addLine")}
                  </p>
                  <OrderLineForm orderId={order.id} parts={parts} />
                </div>
              ) : null}
            </div>
          </SectionBlock>

          <SectionBlock
            id="inspection"
            title={ti("title")}
            subtitle={t("inspectionHint")}
            sectionRef={setSectionRef("inspection")}
          >
            {inspectionContent}
          </SectionBlock>

          <SectionBlock
            id="estimate"
            title={te("title")}
            subtitle={t("estimateHint")}
            sectionRef={setSectionRef("estimate")}
          >
            {estimateContent}
          </SectionBlock>

          <SectionBlock
            id="billing"
            title={tb("title")}
            subtitle={t("billingHint")}
            sectionRef={setSectionRef("billing")}
          >
            {billingContent}
          </SectionBlock>

          <SectionBlock
            id="liveLink"
            title={tl("title")}
            subtitle={tl("subtitle")}
            sectionRef={setSectionRef("liveLink")}
          >
            {liveLinkContent}
          </SectionBlock>

          <SectionBlock
            id="timeline"
            title={t("timeline")}
            sectionRef={setSectionRef("timeline")}
          >
            <div className="px-5 py-5 sm:px-6">
              <OrderTimeline
                events={timeline.map((event) => ({
                  ...event,
                  createdAt: asDate(event.createdAt) ?? new Date(0),
                }))}
                emptyLabel={t("timelineEmpty")}
                formatActor={(actor) =>
                  actor
                    ? actor.name?.trim() || actor.email
                    : t("timelineUnknownActor")
                }
                formatWhen={(date) =>
                  formatDateTime(date, locale, tc("notSet"))
                }
                formatEvent={(event) => {
                  const meta =
                    event.meta && typeof event.meta === "object"
                      ? (event.meta as Record<string, unknown>)
                      : {};
                  if (event.action === "service_order.status_changed") {
                    const to = typeof meta.to === "string" ? meta.to : null;
                    if (meta.created === true && to) {
                      return t("timelineCreated", {
                        status: t(
                          `statuses.${to as ServiceOrderStatusValue}`,
                        ),
                      });
                    }
                    const from =
                      typeof meta.from === "string" ? meta.from : null;
                    if (from && to) {
                      return t("timelineStatusChanged", {
                        from: t(
                          `statuses.${from as ServiceOrderStatusValue}`,
                        ),
                        to: t(`statuses.${to as ServiceOrderStatusValue}`),
                      });
                    }
                  }
                  if (event.action === "service_order.line_added") {
                    const description =
                      typeof meta.description === "string"
                        ? meta.description
                        : t("lineDescription");
                    return t("timelineLineAdded", { description });
                  }
                  if (event.action === "service_order.updated") {
                    return t("timelineUpdated");
                  }
                  return event.action;
                }}
              />
            </div>
          </SectionBlock>
        </div>
      </div>
    </div>
  );
}

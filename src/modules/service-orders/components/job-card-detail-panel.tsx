"use client";

import { useCallback, type ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePageDetailLabel } from "@/components/page-chrome";
import { cn } from "@/lib/utils";
import type { ServiceOrderStatus } from "@/lib/service-order-status";
import { JobCardSectionNav } from "@/modules/service-orders/components/job-card-section-nav";
import {
  OrderLineForm,
  type OrderLinePartOption,
} from "@/modules/service-orders/components/order-line-form";
import { OrderLinesTable } from "@/modules/service-orders/components/order-lines-table";
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

const SECTION_NUMBERS: Record<JobCardSection, string> = {
  details: "01",
  lines: "02",
  inspection: "03",
  estimate: "04",
  billing: "05",
  liveLink: "06",
  timeline: "07",
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
  open,
  children,
}: {
  id: JobCardSection;
  title: string;
  subtitle?: string;
  open: boolean;
  children: ReactNode;
}) {
  return (
    <section
      id={jobCardSectionDomId(id)}
      hidden={!open}
      className={cn(
        "min-w-0 overflow-hidden rounded-[14px] border border-[#d7deea] bg-white shadow-[0_3px_17px_rgba(36,58,99,0.06)]",
        !open && "hidden",
      )}
    >
      <div className="flex items-start gap-3 border-b border-[#d7deea] bg-[#f8fafc] px-4 py-4 sm:px-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[#e8efff] text-[13px] font-black text-[#1f5eff]">
          {SECTION_NUMBERS[id]}
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 className="text-[17px] font-semibold tracking-tight text-[#152238]">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 text-[13px] text-[#5c6b7e]">{subtitle}</p>
          ) : null}
        </div>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
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
  const { activeSection, scrollToSection } = useJobCardSections({
    initialSection,
    syncUrl: true,
    mode: "tabs",
  });

  /** Short sections (e.g. live link) shrink the page; keep the sticky nav at the top. */
  const onSectionChange = useCallback(
    (section: JobCardSection) => {
      scrollToSection(section);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document
            .getElementById("job-card-section-nav")
            ?.scrollIntoView({ block: "start", behavior: "instant" });
        });
      });
    },
    [scrollToSection],
  );

  const labourCount = order.lines.filter((line) => line.type === "LABOUR").length;
  const techLabel =
    order.technician?.name?.trim() ||
    order.technician?.email ||
    t("technicianUnassigned");
  const vehicleLabel = `${order.vehicle.make} ${order.vehicle.model}`.trim();
  const metaParts = [
    order.customer.name,
    vehicleLabel,
    order.bay || null,
    techLabel,
  ].filter(Boolean);
  return (
    <div className="w-full space-y-4">
      <header
        className={cn(
          "flex flex-wrap items-center justify-between gap-3",
          // Mobile: only on Details — short tabs (live link) otherwise pull this into view.
          activeSection !== "details" && "hidden lg:flex",
        )}
      >
        <div className="min-w-0">
          <h1 className="truncate text-[clamp(24px,3.5vw,30px)] leading-tight font-semibold tracking-[0.02em] text-[#152238]">
            {order.vehicle.registrationNumber}
          </h1>
          <p className="mt-1 truncate text-[14px] text-[#5c6b7e]">
            <Link
              href={`/customers/${order.customerId}`}
              className="font-medium text-[#1f5eff] underline-offset-4 hover:underline"
            >
              {order.customer.name}
            </Link>
            {metaParts.slice(1).map((part) => (
              <span key={String(part)}>
                <span className="text-slate-300"> · </span>
                {part}
              </span>
            ))}
          </p>
        </div>
        <span className="inline-flex min-h-9 items-center rounded-full border border-[#c9d8ff] bg-[#e8efff] px-3 py-1.5 text-[13px] font-extrabold text-[#1f5eff]">
          {t(`statuses.${order.status}`)}
        </span>
      </header>

      <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start">
        <aside
          id="job-card-section-nav"
          className="sticky top-0 z-20 w-full shrink-0 bg-background pb-1 lg:top-4 lg:w-[220px] lg:bg-transparent lg:pb-0"
        >
          <JobCardSectionNav
            section={activeSection}
            onSectionChange={onSectionChange}
          />
        </aside>

        <div className="min-w-0 flex-1">
          <SectionBlock
            id="details"
            title={t("details")}
            subtitle={t("detailsHint")}
            open={activeSection === "details"}
          >
            <div className="px-4 py-5 sm:px-5">
              <ServiceOrderForm
                mode="edit"
                orderId={order.id}
                technicians={technicians}
                canEdit={canMutate}
                locked={{
                  customerName: order.customer.name,
                  registrationNumber: order.vehicle.registrationNumber,
                  vehicleLabel,
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
            open={activeSection === "lines"}
          >
            <div className="space-y-5 px-4 py-5 sm:px-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="text-[14px] font-semibold text-slate-900">
                  {t("linesAdded")}
                </strong>
                <small className="text-[13px] text-slate-500">
                  {t("labourPartsCount", {
                    labour: labourCount,
                    parts: order.lines.length - labourCount,
                  })}
                </small>
              </div>

              {order.lines.length === 0 ? (
                <p className="rounded-[10px] border border-dashed border-slate-300 bg-slate-50/50 px-4 py-6 text-[14px] text-slate-600">
                  {t("linesEmpty")}
                </p>
              ) : (
                <OrderLinesTable
                  orderId={order.id}
                  canMutate={canMutate}
                  lines={order.lines}
                />
              )}

              {canMutate ? (
                <div className="space-y-3 border-t border-slate-300 pt-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-[14px] font-semibold text-slate-900">
                      {t("addLine")}
                    </strong>
                    <small className="text-[13px] text-slate-500">
                      {t("addLineHint")}
                    </small>
                  </div>
                  <div className="rounded-[10px] border border-[#e8edf5] bg-[#fafcff] p-4 sm:p-5">
                    <OrderLineForm orderId={order.id} parts={parts} />
                  </div>
                </div>
              ) : null}
            </div>
          </SectionBlock>

          <SectionBlock
            id="inspection"
            title={ti("title")}
            subtitle={t("inspectionHint")}
            open={activeSection === "inspection"}
          >
            {inspectionContent}
          </SectionBlock>

          <SectionBlock
            id="estimate"
            title={te("title")}
            subtitle={t("estimateHint")}
            open={activeSection === "estimate"}
          >
            {estimateContent}
          </SectionBlock>

          <SectionBlock
            id="billing"
            title={tb("title")}
            subtitle={t("billingHint")}
            open={activeSection === "billing"}
          >
            {billingContent}
          </SectionBlock>

          <SectionBlock
            id="liveLink"
            title={tl("title")}
            subtitle={tl("subtitle")}
            open={activeSection === "liveLink"}
          >
            {liveLinkContent}
          </SectionBlock>

          <SectionBlock
            id="timeline"
            title={t("timeline")}
            subtitle={t("timelineHint")}
            open={activeSection === "timeline"}
          >
            <div className="px-4 py-5 sm:px-5">
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

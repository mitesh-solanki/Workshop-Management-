"use client";

import { useCallback, type ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePageDetailLabel } from "@/components/page-chrome";
import { Badge } from "@/components/ui/badge";
import type { ServiceOrderStatus } from "@/lib/service-order-status";
import { LiveLinkStaffPanel } from "@/modules/live-link/components/live-link-staff-panel";
import { JobCardSectionJumpProvider } from "@/modules/service-orders/components/job-card-section-jump";
import { JobCardSectionNav } from "@/modules/service-orders/components/job-card-section-nav";
import {
  LatestEstimateLinesCard,
  type LatestEstimateLine,
} from "@/modules/service-orders/components/latest-estimate-lines-card";
import { OrderLineForm } from "@/modules/service-orders/components/order-line-form";
import { OrderLinesTable } from "@/modules/service-orders/components/order-lines-table";
import { OutsideWorkForm } from "@/modules/service-orders/components/outside-work-form";
import { JobCardTimeline } from "@/modules/service-orders/components/job-card-timeline";
import {
  PaperJobCardHeaderUpload,
  PaperJobCardPanel,
  type PaperCopyView,
} from "@/modules/service-orders/components/paper-job-card-panel";
import {
  datetimeLocalFromOrder,
  ServiceOrderForm,
} from "@/modules/service-orders/components/service-order-form";
import {
  FULL_JOB_CARD_SURFACE,
  type JobCardSection,
  type JobCardSurface,
} from "@/modules/service-orders/job-card-sections";
import type { ServiceOrderStatusValue } from "@/modules/service-orders/schema";
import {
  formatTechniciansList,
  technicianIdsFromOrder,
} from "@/modules/service-orders/technicians";
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
  partId?: string | null;
  catalogueSellingPricePaise?: number | null;
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
  vehicleId: string;
  customer: { name: string };
  jobCardNumber: number;
  vehicle: { registrationNumber: string; make: string; model: string };
  technician: { name: string | null; email: string } | null;
  technicianAssignments?: Array<{
    technicianId: string;
    technician: { id?: string; name: string | null; email: string };
  }>;
  lines: OrderLine[];
};

type BayOption = {
  id: string;
  name: string;
};

type Props = {
  order: OrderData;
  timeline: TimelineEvent[];
  technicians: TechnicianOption[];
  bays: BayOption[];
  canMutate: boolean;
  /**
   * Role surface. Defaults to full Owner/Manager card.
   * Pass TECHNICIAN_JOB_CARD_SURFACE for technicians only.
   */
  surface?: JobCardSurface;
  locale: string;
  initialSection?: JobCardSection;
  /** Latest customer-confirmed estimate lines for this customer + vehicle. */
  latestEstimate?: {
    lines: LatestEstimateLine[];
  } | null;
  /** Full estimate page (inspection report) for deeper edits. */
  estimateHref?: string | null;
  billingContent: ReactNode;
  /** Owner/staff: live link controls in Customer bill header after estimate exists. */
  liveLink?: {
    active: { id: string; expiresAt: Date | string } | null;
    canEdit: boolean;
    showInBillingHeader: boolean;
  };
  paperCopies?: PaperCopyView[];
  canEditPaper?: boolean;
  /** none = no bill; draft = quiet sync; finalized = Yes/No confirm. */
  billSyncMode?: "none" | "draft" | "finalized";
};

const SECTION_BODY_CLASS = "space-y-5";

function asDate(value: Date | string | null): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function SectionPanel({
  id,
  open,
  children,
}: {
  id: JobCardSection;
  open: boolean;
  children: ReactNode;
}) {
  return (
    <div
      id={jobCardSectionDomId(id)}
      role="tabpanel"
      aria-hidden={!open}
      hidden={!open}
      className="min-w-0 outline-none"
    >
      {open ? children : null}
    </div>
  );
}

export function JobCardDetailPanel({
  order,
  timeline,
  technicians,
  bays,
  canMutate,
  surface = FULL_JOB_CARD_SURFACE,
  locale: _locale,
  initialSection = "details",
  latestEstimate = null,
  estimateHref = null,
  billingContent,
  liveLink,
  paperCopies = [],
  canEditPaper = false,
  billSyncMode = "none",
}: Props) {
  const t = useTranslations("orders");
  const tb = useTranslations("billing");
  usePageDetailLabel(order.vehicle.registrationNumber);
  const sections = surface.sections;
  const hidePrices = surface.hidePrices;
  const showCommercial = surface.includeCommercialSections;
  const { activeSection, scrollToSection } = useJobCardSections({
    initialSection,
    syncUrl: true,
    mode: "tabs",
    sections,
  });

  const sectionNumbers = Object.fromEntries(
    sections.map((id, index) => [
      id,
      String(index + 1).padStart(2, "0"),
    ]),
  ) as Record<JobCardSection, string>;

  const onSectionChange = useCallback(
    (section: JobCardSection) => {
      scrollToSection(section);
    },
    [scrollToSection],
  );

  const labourPartLines = order.lines.filter(
    (line) => line.type === "LABOUR" || line.type === "PART",
  );
  const outsideWorkLines = order.lines.filter(
    (line) => line.type === "OUTSIDE",
  );
  /** Estimate is separate from job-card lines — split only by estimate type. */
  const outsideEstimateLines =
    latestEstimate?.lines.filter((line) => line.type === "OUTSIDE") ?? [];
  const labourPartEstimateLines =
    latestEstimate?.lines.filter((line) => line.type !== "OUTSIDE") ?? [];
  const visibleLines = hidePrices
    ? labourPartLines.filter((line) => line.type === "PART")
    : labourPartLines;
  const labourCount = labourPartLines.filter(
    (line) => line.type === "LABOUR",
  ).length;
  const partCount = labourPartLines.filter((line) => line.type === "PART").length;
  const needsPricing =
    !hidePrices &&
    order.status !== "COMPLETED" &&
    order.lines.some(
      (line) =>
        line.type === "PART" &&
        line.unitPricePaise === 0 &&
        Boolean(line.partId) &&
        (line.catalogueSellingPricePaise ?? 0) <= 0,
    );
  const techLabel = formatTechniciansList(order, t("technicianUnassigned"));
  const vehicleLabel = `${order.vehicle.make} ${order.vehicle.model}`.trim();
  const metaParts = hidePrices
    ? [vehicleLabel, order.bay || null].filter(Boolean)
    : [order.customer.name, vehicleLabel, order.bay || null, techLabel].filter(
        Boolean,
      );

  const sectionTitles: Record<JobCardSection, string> = {
    details: t("details"),
    lines: t("lines"),
    outsideWork: t("outsideWork"),
    billing: tb("title"),
    paper: t("paperTitle"),
    timeline: t("timeline"),
  };

  const sectionSubtitles: Record<JobCardSection, string | undefined> = {
    details: t("detailsHint"),
    lines: t("linesDescription"),
    outsideWork: t("outsideWorkHint"),
    billing: t("billingHint"),
    paper: t("paperHint"),
    timeline: t("timelineHint"),
  };

  return (
    <JobCardSectionJumpProvider onJump={onSectionChange}>
      <div className="w-full space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-[clamp(24px,3.5vw,30px)] leading-tight font-semibold tracking-[0.02em] text-[#152238]">
              {order.vehicle.registrationNumber}
            </h1>
            <p className="mt-1 truncate text-[14px] text-[#5c6b7e]">
              <span className="font-mono font-semibold text-[#152238]">
                {t("jobCardNumberShort", { number: order.jobCardNumber })}
              </span>
              <span className="text-slate-300"> · </span>
              {hidePrices ? (
                metaParts.map((part, index) => (
                  <span key={String(part)}>
                    {index > 0 ? (
                      <span className="text-slate-300"> · </span>
                    ) : null}
                    {part}
                  </span>
                ))
              ) : (
                <>
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
                </>
              )}
            </p>
          </div>
          {needsPricing ? (
            <Badge variant="warning">{t("needsPricing")}</Badge>
          ) : null}
        </header>

        <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start">
          <aside
            id="job-card-section-nav"
            className="sticky top-0 z-20 w-full shrink-0 bg-background pb-1 lg:top-4 lg:w-[220px] lg:bg-transparent lg:pb-0"
          >
            <JobCardSectionNav
              section={activeSection}
              onSectionChange={onSectionChange}
              sections={sections}
            />
          </aside>

          <div className={hidePrices ? "min-w-0 w-full max-w-3xl" : "min-w-0 flex-1"}>
            <section
              aria-labelledby="job-card-active-section-title"
              className="min-w-0 overflow-hidden rounded-[14px] border border-[#d7deea] bg-white shadow-[0_3px_17px_rgba(36,58,99,0.06)]"
            >
              <div className="flex flex-col gap-3 border-b border-[#d7deea] bg-[#f8fafc] px-4 py-4 sm:flex-row sm:items-start sm:gap-4 sm:px-5">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[#e8efff] text-[13px] font-black text-[#1f5eff]">
                    {sectionNumbers[activeSection] ?? "01"}
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <h2
                      id="job-card-active-section-title"
                      className="text-[17px] font-semibold tracking-tight text-[#152238]"
                    >
                      {sectionTitles[activeSection]}
                    </h2>
                    {sectionSubtitles[activeSection] ? (
                      <p className="mt-1 text-[13px] text-[#5c6b7e]">
                        {sectionSubtitles[activeSection]}
                      </p>
                    ) : null}
                  </div>
                </div>
                {activeSection === "billing" &&
                liveLink?.showInBillingHeader ? (
                  <LiveLinkStaffPanel
                    orderId={order.id}
                    active={liveLink.active}
                    canEdit={liveLink.canEdit}
                    variant="header"
                  />
                ) : null}
                {activeSection === "paper" ? (
                  <PaperJobCardHeaderUpload
                    serviceOrderId={order.id}
                    customerId={order.customerId}
                    vehicleId={order.vehicleId}
                    canEdit={canEditPaper}
                    copyCount={paperCopies.length}
                  />
                ) : null}
              </div>

              <div className="min-w-0 px-4 py-5 sm:px-5">
                <SectionPanel id="details" open={activeSection === "details"}>
                  <div className={SECTION_BODY_CLASS}>
                    <ServiceOrderForm
                      mode="edit"
                      orderId={order.id}
                      technicians={technicians}
                      bays={bays}
                      canEdit={canMutate}
                      technicianFieldsOnly={hidePrices}
                      locked={{
                        customerName: order.customer.name,
                        registrationNumber: order.vehicle.registrationNumber,
                        vehicleLabel,
                      }}
                      defaults={{
                        jobCardNumber: order.jobCardNumber,
                        complaint: order.complaint,
                        requestedServices: order.requestedServices ?? "",
                        odometerIn: order.odometerIn,
                        expectedCompletion: datetimeLocalFromOrder(
                          order.expectedCompletion,
                        ),
                        technicianIds: technicianIdsFromOrder(order),
                        bay: order.bay ?? "",
                        priority: order.priority,
                        status: order.status as ServiceOrderStatusValue,
                      }}
                    />
                  </div>
                </SectionPanel>

                <SectionPanel id="lines" open={activeSection === "lines"}>
                  <div className={SECTION_BODY_CLASS}>
                    {labourPartEstimateLines.length > 0 ? (
                      <LatestEstimateLinesCard
                        orderId={order.id}
                        lines={labourPartEstimateLines}
                        hidePrices={hidePrices}
                        canEdit={canMutate && !hidePrices}
                        estimateHref={estimateHref}
                      />
                    ) : null}

                    {canMutate && hidePrices ? (
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          <strong className="text-[14px] font-semibold text-slate-900">
                            {t("addSparePart")}
                          </strong>
                          <small className="text-[13px] text-slate-500">
                            {t("addSparePartHint")}
                          </small>
                        </div>
                        <div className="rounded-[10px] border border-[#e8edf5] bg-[#fafcff] p-3.5 sm:p-4">
                          <OrderLineForm
                            orderId={order.id}
                            hidePrices={hidePrices}
                            billSyncMode={billSyncMode}
                          />
                        </div>
                      </div>
                    ) : null}

                    <div
                      className={
                        canMutate && hidePrices
                          ? "space-y-3 border-t border-slate-300 pt-5"
                          : "space-y-3"
                      }
                    >
                      <div className="flex flex-wrap items-baseline gap-2">
                        <strong className="text-[14px] font-semibold text-slate-900">
                          {t("linesAdded")}
                        </strong>
                        <small className="text-[13px] text-slate-500">
                          {hidePrices
                            ? t("partsCount", { count: partCount })
                            : t("labourPartsCount", {
                                labour: labourCount,
                                parts: partCount,
                              })}
                        </small>
                      </div>
                      {needsPricing ? (
                        <p className="rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-950">
                          {t("needsPricingHint")}
                        </p>
                      ) : null}

                      {visibleLines.length === 0 ? (
                        <p className="rounded-[10px] border border-dashed border-slate-300 bg-slate-50/50 px-4 py-6 text-[14px] text-slate-600">
                          {hidePrices ? t("partsEmpty") : t("linesEmpty")}
                        </p>
                      ) : (
                        <OrderLinesTable
                          orderId={order.id}
                          canMutate={canMutate}
                          hidePrices={hidePrices}
                          billSyncMode={billSyncMode}
                          lines={visibleLines}
                        />
                      )}
                    </div>

                    {canMutate && !hidePrices ? (
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
                          <OrderLineForm
                            orderId={order.id}
                            hidePrices={hidePrices}
                            billSyncMode={billSyncMode}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </SectionPanel>

                {showCommercial ? (
                  <SectionPanel
                    id="outsideWork"
                    open={activeSection === "outsideWork"}
                  >
                    <div className="w-full max-w-2xl space-y-5">
                      {outsideEstimateLines.length > 0 ? (
                        <LatestEstimateLinesCard
                          orderId={order.id}
                          lines={outsideEstimateLines}
                          hidePrices={false}
                          canEdit={canMutate}
                          hideQuantity
                          amountLabel={t("outsideWorkAmount")}
                          hint={t("latestEstimateOutsideHint")}
                          estimateHref={estimateHref}
                        />
                      ) : null}

                      <div className="space-y-3">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <strong className="text-[14px] font-semibold text-slate-900">
                            {t("outsideWorkList")}
                          </strong>
                          <small className="text-[13px] text-slate-500">
                            {t("outsideWorkCount", {
                              count: outsideWorkLines.length,
                            })}
                          </small>
                        </div>
                        {outsideWorkLines.length === 0 ? (
                          <p className="rounded-[10px] border border-dashed border-slate-300 bg-slate-50/50 px-4 py-6 text-[14px] text-slate-600">
                            {t("outsideWorkEmpty")}
                          </p>
                        ) : (
                          <OrderLinesTable
                            orderId={order.id}
                            canMutate={canMutate}
                            hidePrices={false}
                            hideType
                            hideQuantity
                            amountLabel={t("outsideWorkAmount")}
                            billSyncMode={billSyncMode}
                            lines={outsideWorkLines}
                          />
                        )}
                      </div>

                      {canMutate ? (
                        <div className="space-y-3 border-t border-slate-300 pt-5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <strong className="text-[14px] font-semibold text-slate-900">
                              {t("addOutsideWork")}
                            </strong>
                            <small className="text-[13px] text-slate-500">
                              {t("outsideWorkHint")}
                            </small>
                          </div>
                          <div className="rounded-[10px] border border-[#e8edf5] bg-[#fafcff] p-4 sm:p-5">
                            <OutsideWorkForm
                              orderId={order.id}
                              billSyncMode={billSyncMode}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </SectionPanel>
                ) : null}

                {showCommercial ? (
                  <SectionPanel id="billing" open={activeSection === "billing"}>
                    {billingContent}
                  </SectionPanel>
                ) : null}

                {showCommercial ? (
                  <SectionPanel id="paper" open={activeSection === "paper"}>
                    <PaperJobCardPanel
                      embedded
                      serviceOrderId={order.id}
                      customerId={order.customerId}
                      vehicleId={order.vehicleId}
                      canEdit={canEditPaper}
                      copies={paperCopies}
                    />
                  </SectionPanel>
                ) : null}

                {showCommercial ? (
                  <SectionPanel id="timeline" open={activeSection === "timeline"}>
                    <div className={SECTION_BODY_CLASS}>
                      <JobCardTimeline
                        events={timeline.map((event) => ({
                          ...event,
                          createdAt: asDate(event.createdAt) ?? new Date(0),
                        }))}
                      />
                    </div>
                  </SectionPanel>
                ) : null}
              </div>
            </section>
          </div>
        </div>
      </div>
    </JobCardSectionJumpProvider>
  );
}

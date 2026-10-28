"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { JobCardSectionNav } from "@/modules/service-orders/components/job-card-section-nav";
import { ServiceOrderForm } from "@/modules/service-orders/components/service-order-form";
import {
  FULL_JOB_CARD_SURFACE,
  type JobCardSection,
  type JobCardSurface,
} from "@/modules/service-orders/job-card-sections";
import {
  jobCardSectionDomId,
  useJobCardSections,
} from "@/modules/service-orders/use-job-card-sections";

export type VehicleOption = {
  id: string;
  registrationNumber: string;
  make: string;
  model: string;
  odometer: number | null;
  customerName: string;
};

type TechnicianOption = {
  id: string;
  name: string | null;
  email: string;
};

type BayOption = {
  id: string;
  name: string;
};

type Props = {
  vehicles: VehicleOption[];
  technicians: TechnicianOption[];
  bays: BayOption[];
  initialVehicleId?: string;
  /** When set (technician create), assignment is locked to this user. */
  lockTechnicianId?: string;
  /** Defaults to full Owner/Manager surface — pass technician surface separately. */
  surface?: JobCardSurface;
};

function SectionBlock({
  id,
  title,
  subtitle,
  sectionRef,
  sectionNumber,
  children,
}: {
  id: JobCardSection;
  title: string;
  subtitle?: string;
  sectionRef: (node: HTMLElement | null) => void;
  sectionNumber: string;
  children: ReactNode;
}) {
  return (
    <section
      id={jobCardSectionDomId(id)}
      ref={sectionRef}
      className="min-w-0 scroll-mt-24 overflow-hidden rounded-[14px] border border-[#d7deea] bg-white shadow-[0_3px_17px_rgba(36,58,99,0.06)] lg:scroll-mt-6"
    >
      <div className="flex items-start gap-3 border-b border-[#d7deea] bg-[#f8fafc] px-4 py-4 sm:px-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[#e8efff] text-[13px] font-black text-[#1f5eff]">
          {sectionNumber}
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 className="text-[17px] font-semibold tracking-tight text-[#152238]">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 text-[12px] text-[#5c6b7e]">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function LockedBody({ onGoDetails }: { onGoDetails: () => void }) {
  const t = useTranslations("orders");
  return (
    <div className="px-5 py-5 sm:px-6">
      <EmptyState
        compact
        title={t("createSectionsLockedTitle")}
        description={t("createSectionsLockedBody")}
        action={
          <button
            type="button"
            onClick={onGoDetails}
            className="text-sm font-medium text-teal-700 underline-offset-4 hover:underline"
          >
            {t("createSectionsLockedAction")}
          </button>
        }
      />
    </div>
  );
}

export function NewJobCardForm({
  vehicles,
  technicians,
  bays,
  initialVehicleId = "",
  lockTechnicianId,
  surface = FULL_JOB_CARD_SURFACE,
}: Props) {
  const t = useTranslations("orders");
  const ti = useTranslations("inspections");
  const te = useTranslations("estimates");
  const tb = useTranslations("billing");
  const [vehicleId, setVehicleId] = useState(initialVehicleId);
  const sections = surface.sections;
  const showCommercial = surface.includeCommercialSections;
  const { activeSection, scrollToSection, setSectionRef } = useJobCardSections({
    sections,
  });
  const sectionNumbers = Object.fromEntries(
    sections.map((id, index) => [
      id,
      String(index + 1).padStart(2, "0"),
    ]),
  ) as Record<JobCardSection, string>;

  const selected = useMemo(
    () => vehicles.find((item) => item.id === vehicleId) ?? null,
    [vehicles, vehicleId],
  );

  const vehicleOptions = useMemo(() => {
    const options = vehicles.map((vehicle) => ({
      value: vehicle.id,
      label: `${vehicle.registrationNumber} — ${vehicle.make} ${vehicle.model}`,
      keywords: `${vehicle.registrationNumber} ${vehicle.make} ${vehicle.model} ${vehicle.customerName}`,
    }));
    if (!vehicleId) return options;
    const current = options.find((option) => option.value === vehicleId);
    if (!current) return options;
    return [current, ...options.filter((option) => option.value !== vehicleId)];
  }, [vehicles, vehicleId]);

  function goToDetails() {
    scrollToSection("details");
  }

  return (
    <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start">
      <aside className="sticky top-0 z-20 w-full shrink-0 bg-background pb-1 lg:top-4 lg:w-[220px] lg:bg-transparent lg:pb-0 xl:w-[240px]">
        <JobCardSectionNav
          section={activeSection}
          onSectionChange={scrollToSection}
          sections={sections}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <SectionBlock
          id="details"
          title={t("details")}
          subtitle={t("detailsHint")}
          sectionRef={setSectionRef("details")}
          sectionNumber={sectionNumbers.details}
        >
          <div className="space-y-6 px-5 py-5 sm:px-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="vehicleId-picker"
                label={t("selectVehicle")}
                hint={t("selectVehicleHint")}
              >
                <SearchableSelect
                  id="vehicleId-picker"
                  value={vehicleId}
                  onChange={setVehicleId}
                  options={vehicleOptions}
                  clearable={false}
                  placeholder={t("selectVehiclePlaceholder")}
                  searchPlaceholder={t("selectVehicleSearchPlaceholder")}
                  emptyLabel={t("selectVehicleEmpty")}
                />
              </FormField>
              <FormField id="locked-customer" label={t("customer")}>
                <Input
                  id="locked-customer"
                  value={selected?.customerName ?? ""}
                  placeholder={t("selectVehiclePlaceholder")}
                  disabled
                  readOnly
                  className="h-11 min-h-11"
                />
              </FormField>
            </div>

            {selected ? (
              <ServiceOrderForm
                key={selected.id}
                mode="create"
                vehicleId={selected.id}
                defaultOdometer={selected.odometer}
                technicians={technicians}
                bays={bays}
                lockTechnicianId={lockTechnicianId}
              />
            ) : (
              <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center text-body text-slate-600">
                {t("selectVehicleHint")}
              </p>
            )}
          </div>
        </SectionBlock>

        <SectionBlock
          id="inspection"
          title={ti("title")}
          subtitle={t("inspectionHint")}
          sectionRef={setSectionRef("inspection")}
          sectionNumber={sectionNumbers.inspection}
        >
          <LockedBody onGoDetails={goToDetails} />
        </SectionBlock>

        <SectionBlock
          id="lines"
          title={t("lines")}
          subtitle={t("linesDescription")}
          sectionRef={setSectionRef("lines")}
          sectionNumber={sectionNumbers.lines}
        >
          <LockedBody onGoDetails={goToDetails} />
        </SectionBlock>

        {showCommercial ? (
          <SectionBlock
            id="estimate"
            title={te("title")}
            subtitle={t("estimateHint")}
            sectionRef={setSectionRef("estimate")}
            sectionNumber={sectionNumbers.estimate}
          >
            <LockedBody onGoDetails={goToDetails} />
          </SectionBlock>
        ) : null}

        {showCommercial ? (
          <SectionBlock
            id="billing"
            title={tb("title")}
            subtitle={t("billingHint")}
            sectionRef={setSectionRef("billing")}
            sectionNumber={sectionNumbers.billing}
          >
            <LockedBody onGoDetails={goToDetails} />
          </SectionBlock>
        ) : null}

        {showCommercial ? (
          <SectionBlock
            id="timeline"
            title={t("timeline")}
            subtitle={t("timelineHint")}
            sectionRef={setSectionRef("timeline")}
            sectionNumber={sectionNumbers.timeline}
          >
            <LockedBody onGoDetails={goToDetails} />
          </SectionBlock>
        ) : null}
      </div>
    </div>
  );
}

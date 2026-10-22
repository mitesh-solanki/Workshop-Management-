"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  ClipboardList,
  FileText,
  History,
  Search,
  type LucideIcon,
} from "lucide-react";
import {
  Card,
  CardDescription,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { JobCardSectionNav } from "@/modules/service-orders/components/job-card-section-nav";
import { ServiceOrderForm } from "@/modules/service-orders/components/service-order-form";
import type { JobCardSection } from "@/modules/service-orders/job-card-sections";
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

type Props = {
  vehicles: VehicleOption[];
  technicians: TechnicianOption[];
  /** Prefill when opened from a vehicle. */
  initialVehicleId?: string;
};

const selectClass =
  "h-11 min-h-11 w-full rounded-md border border-input bg-transparent px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/40 md:text-sm";

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
    <section
      id={jobCardSectionDomId(id)}
      ref={sectionRef}
      className="scroll-mt-4 border-b border-border last:border-b-0"
    >
      <div className="border-b border-border px-5 py-3.5 sm:px-6">
        <h2 className="text-section-title text-slate-900">{title}</h2>
        {subtitle ? (
          <CardDescription className="mt-0.5">{subtitle}</CardDescription>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function LockedBody({
  icon: Icon,
  onGoDetails,
}: {
  icon: LucideIcon;
  onGoDetails: () => void;
}) {
  const t = useTranslations("orders");
  return (
    <div className="px-5 py-5 sm:px-6">
      <EmptyState
        compact
        icon={Icon}
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
  initialVehicleId = "",
}: Props) {
  const t = useTranslations("orders");
  const ti = useTranslations("inspections");
  const te = useTranslations("estimates");
  const [vehicleId, setVehicleId] = useState(initialVehicleId);
  const { activeSection, scrollToSection, setSectionRef } = useJobCardSections();

  const selected = useMemo(
    () => vehicles.find((item) => item.id === vehicleId) ?? null,
    [vehicles, vehicleId],
  );

  function goToDetails() {
    scrollToSection("details");
  }

  return (
    <div className="grid w-full items-start gap-4 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)]">
      <JobCardSectionNav
        section={activeSection}
        onSectionChange={scrollToSection}
      />

      <Card className="min-w-0 gap-0 overflow-visible py-0">
        <SectionBlock
          id="details"
          title={t("details")}
          subtitle={t("detailsHint")}
          sectionRef={setSectionRef("details")}
        >
          <div className="space-y-6 px-5 py-5 sm:px-6">
            <FormField
              id="vehicleId-picker"
              label={t("selectVehicle")}
              hint={t("selectVehicleHint")}
            >
              <select
                id="vehicleId-picker"
                className={selectClass}
                value={vehicleId}
                onChange={(event) => setVehicleId(event.target.value)}
              >
                <option value="">{t("selectVehiclePlaceholder")}</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {`${vehicle.registrationNumber} — ${vehicle.customerName} (${vehicle.make} ${vehicle.model})`}
                  </option>
                ))}
              </select>
            </FormField>

            {selected ? (
              <ServiceOrderForm
                key={selected.id}
                mode="create"
                vehicleId={selected.id}
                defaultOdometer={selected.odometer}
                technicians={technicians}
                locked={{
                  customerName: selected.customerName,
                  registrationNumber: selected.registrationNumber,
                  vehicleLabel: `${selected.make} ${selected.model}`.trim(),
                }}
              />
            ) : (
              <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center text-body text-slate-600">
                {t("selectVehicleHint")}
              </p>
            )}
          </div>
        </SectionBlock>

        <SectionBlock
          id="lines"
          title={t("lines")}
          subtitle={t("linesDescription")}
          sectionRef={setSectionRef("lines")}
        >
          <LockedBody icon={ClipboardList} onGoDetails={goToDetails} />
        </SectionBlock>

        <SectionBlock
          id="inspection"
          title={ti("title")}
          subtitle={t("inspectionHint")}
          sectionRef={setSectionRef("inspection")}
        >
          <LockedBody icon={Search} onGoDetails={goToDetails} />
        </SectionBlock>

        <SectionBlock
          id="estimate"
          title={te("title")}
          subtitle={t("estimateHint")}
          sectionRef={setSectionRef("estimate")}
        >
          <LockedBody icon={FileText} onGoDetails={goToDetails} />
        </SectionBlock>

        <SectionBlock
          id="timeline"
          title={t("timeline")}
          sectionRef={setSectionRef("timeline")}
        >
          <LockedBody icon={History} onGoDetails={goToDetails} />
        </SectionBlock>
      </Card>
    </div>
  );
}

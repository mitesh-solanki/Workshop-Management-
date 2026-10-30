"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AddChecklistItemForm } from "@/modules/inspections/components/add-checklist-item-form";
import { InspectionConditionGrid } from "@/modules/inspections/components/inspection-condition-grid";
import { InspectionNotesForm } from "@/modules/inspections/components/inspection-notes-form";
import { InspectionSectionNav } from "@/modules/inspections/components/inspection-section-nav";
import {
  clampInspectionSection,
  type InspectionSection,
} from "@/modules/inspections/inspection-sections";
import type { InspectionItemResultValue } from "@/modules/inspections/schema";

type Media = {
  id: string;
  kind: "PHOTO" | "VIDEO";
  url: string;
  contentType: string;
};

type Item = {
  id: string;
  key: string;
  label: string;
  result: InspectionItemResultValue | null;
  notes: string | null;
  quantity: number;
  unitPricePaise: number;
  externalCheck: boolean;
  media: Media[];
};

type Props = {
  inspection: {
    id: string;
    complaint: string | null;
    recommendedNotes: string | null;
    customerId: string;
    vehicleId: string;
    serviceOrderId: string | null;
    customer: { name: string };
    vehicle: {
      registrationNumber: string;
      make: string;
      model: string;
    };
  };
  items: Item[];
  canEdit: boolean;
  initialSection?: string | null;
};

export function InspectionDetailPanel({
  inspection,
  items,
  canEdit,
  initialSection = "info",
}: Props) {
  const t = useTranslations("inspections");
  const [activeSection, setActiveSection] = useState<InspectionSection>(() =>
    clampInspectionSection(initialSection),
  );

  const onSectionChange = useCallback((section: InspectionSection) => {
    setActiveSection(section);
    if (typeof window !== "undefined") {
      const url =
        section === "info"
          ? window.location.pathname
          : `${window.location.pathname}?section=${section}`;
      window.history.replaceState(window.history.state, "", url);
    }
  }, []);

  const sectionNumbers: Record<InspectionSection, string> = {
    info: "01",
    report: "02",
  };

  const sectionTitles: Record<InspectionSection, string> = {
    info: t("sections.info"),
    report: t("sections.report"),
  };

  const sectionSubtitles: Record<InspectionSection, string> = {
    info: t("sectionHints.info"),
    report: t("sectionHints.report"),
  };

  const title = inspection.vehicle.registrationNumber;
  const vehicleLabel = `${inspection.vehicle.make} ${inspection.vehicle.model}`;

  return (
    <div className="w-full space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-[clamp(24px,3.5vw,30px)] leading-tight font-semibold tracking-[0.02em] text-[#152238]">
            {title}
          </h1>
          <p className="mt-1 truncate text-[14px] text-[#5c6b7e]">
            <Link
              href={`/customers/${inspection.customerId}`}
              className="font-medium text-[#1f5eff] underline-offset-4 hover:underline"
            >
              {inspection.customer.name}
            </Link>
            <span className="text-slate-300"> · </span>
            <Link
              href={`/vehicles/${inspection.vehicleId}`}
              className="underline-offset-4 hover:text-blue-700 hover:underline"
            >
              {vehicleLabel}
            </Link>
          </p>
        </div>
        {inspection.serviceOrderId ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Badge variant="success">{t("linked")}</Badge>
            <Button asChild variant="outline" size="md">
              <Link href={`/orders/${inspection.serviceOrderId}`}>
                {t("openJobCard")}
              </Link>
            </Button>
          </div>
        ) : null}
      </header>

      <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start">
        <aside className="sticky top-0 z-20 w-full shrink-0 bg-background pb-1 lg:top-4 lg:w-[220px] lg:bg-transparent lg:pb-0">
          <InspectionSectionNav
            section={activeSection}
            onSectionChange={onSectionChange}
          />
        </aside>

        <div className="min-w-0 flex-1">
          <section
            aria-labelledby="inspection-active-section-title"
            className="min-w-0 overflow-hidden rounded-[14px] border border-[#d7deea] bg-white shadow-[0_3px_17px_rgba(36,58,99,0.06)]"
          >
            <div className="flex flex-col gap-3 border-b border-[#d7deea] bg-[#f8fafc] px-4 py-4 sm:flex-row sm:items-start sm:gap-4 sm:px-5">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[#e8efff] text-[13px] font-black text-[#1f5eff]">
                  {sectionNumbers[activeSection]}
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <h2
                    id="inspection-active-section-title"
                    className="text-[17px] font-semibold tracking-tight text-[#152238]"
                  >
                    {sectionTitles[activeSection]}
                  </h2>
                  <p className="mt-1 text-[13px] text-[#5c6b7e]">
                    {sectionSubtitles[activeSection]}
                  </p>
                </div>
              </div>
            </div>

            <div className="min-w-0 space-y-5 px-4 py-5 sm:px-5">
              {activeSection === "info" ? (
                <>
                  <InspectionNotesForm
                    inspectionId={inspection.id}
                    complaint={inspection.complaint}
                    recommendedNotes={inspection.recommendedNotes}
                    canEdit={canEdit}
                  />
                  {canEdit ? (
                    <div className="rounded-[10px] border border-dashed border-slate-300 bg-slate-50/80 p-4">
                      <AddChecklistItemForm inspectionId={inspection.id} />
                    </div>
                  ) : null}
                  <InspectionConditionGrid
                    inspectionId={inspection.id}
                    canEdit={canEdit}
                    items={items}
                  />
                </>
              ) : (
                <div className="rounded-[10px] border border-dashed border-slate-300 bg-slate-50/80 px-4 py-10 text-center">
                  <p className="text-sm font-medium text-slate-700">
                    {t("reportComingSoonTitle")}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {t("reportComingSoonBody")}
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

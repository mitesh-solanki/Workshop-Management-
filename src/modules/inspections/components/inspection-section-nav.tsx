"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  INSPECTION_SECTIONS,
  type InspectionSection,
} from "@/modules/inspections/inspection-sections";

type Props = {
  section: InspectionSection;
  onSectionChange: (section: InspectionSection) => void;
};

export function InspectionSectionNav({ section, onSectionChange }: Props) {
  const t = useTranslations("inspections");

  const labels: Record<InspectionSection, string> = {
    info: t("sections.info"),
    report: t("sections.report"),
  };

  const subs: Record<InspectionSection, string> = {
    info: t("sectionNav.info"),
    report: t("sectionNav.report"),
  };

  return (
    <nav
      aria-label={t("sectionsTitle")}
      className="rounded-[14px] border border-[#d7deea] bg-white p-2.5 shadow-[0_3px_17px_rgba(36,58,99,0.06)]"
    >
      <h3 className="mb-2 hidden px-2 pt-0.5 text-[11px] font-extrabold tracking-[0.08em] text-slate-400 uppercase lg:block">
        {t("sectionsTitle")}
      </h3>
      <div className="flex gap-1.5 overflow-x-auto lg:flex-col lg:overflow-visible">
        {INSPECTION_SECTIONS.map((id, index) => {
          const isActive = section === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSectionChange(id)}
              aria-current={isActive ? "true" : undefined}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left transition-colors lg:w-full",
                isActive
                  ? "bg-[#e8efff] text-[#1f5eff]"
                  : "text-slate-600 hover:bg-slate-50 hover:text-[#1f5eff]",
              )}
            >
              <span
                className={cn(
                  "grid size-[22px] shrink-0 place-items-center rounded-md border text-[10px] font-black",
                  isActive
                    ? "border-blue-200 bg-white text-[#1f5eff]"
                    : "border-[#d7deea] bg-white text-slate-500",
                )}
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-bold">
                  {labels[id]}
                </span>
                <span className="mt-0.5 hidden text-[11px] font-medium text-slate-500 lg:block">
                  {subs[id]}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

"use client";

import {
  ClipboardList,
  FileText,
  History,
  Link2,
  NotebookPen,
  Receipt,
  Search,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { SectionSideNav } from "@/components/shared/section-side-nav";
import {
  JOB_CARD_SECTIONS,
  type JobCardSection,
} from "@/modules/service-orders/job-card-sections";

type Props = {
  section: JobCardSection;
  onSectionChange: (section: JobCardSection) => void;
};

const SECTION_ICONS: Record<JobCardSection, LucideIcon> = {
  details: NotebookPen,
  lines: ClipboardList,
  inspection: Search,
  estimate: FileText,
  billing: Receipt,
  liveLink: Link2,
  timeline: History,
};

export function JobCardSectionNav({ section, onSectionChange }: Props) {
  const t = useTranslations("orders");
  const ti = useTranslations("inspections");
  const te = useTranslations("estimates");
  const tb = useTranslations("billing");
  const tl = useTranslations("liveLink");

  const labels: Record<JobCardSection, string> = {
    details: t("details"),
    lines: t("lines"),
    inspection: ti("title"),
    estimate: te("title"),
    billing: tb("title"),
    liveLink: tl("title"),
    timeline: t("timeline"),
  };

  return (
    <SectionSideNav
      title={t("sectionsTitle")}
      active={section}
      onChange={onSectionChange}
      items={JOB_CARD_SECTIONS.map((id) => ({
        id,
        label: labels[id],
        icon: SECTION_ICONS[id],
      }))}
    />
  );
}

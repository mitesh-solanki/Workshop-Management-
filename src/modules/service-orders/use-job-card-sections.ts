"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  sectionDomId,
  useSectionScrollSpy,
} from "@/hooks/use-section-scroll-spy";
import {
  JOB_CARD_SECTIONS,
  type JobCardSection,
} from "@/modules/service-orders/job-card-sections";

const SECTION_ID_PREFIX = "job-card-section-";

export function jobCardSectionDomId(section: JobCardSection): string {
  return sectionDomId(SECTION_ID_PREFIX, section);
}

type Options = {
  initialSection?: JobCardSection;
  /** Write `?section=` only when the user clicks the left nav. */
  syncUrl?: boolean;
  /**
   * `tabs` — one section visible (dummy job-card style).
   * `scroll` — all sections stacked with scroll-spy highlight.
   */
  mode?: "tabs" | "scroll";
};

export function useJobCardSections({
  initialSection = "details",
  syncUrl = false,
  mode = "scroll",
}: Options = {}) {
  const router = useRouter();
  const pathname = usePathname();

  const syncSectionToUrl = useCallback(
    (section: JobCardSection) => {
      if (!syncUrl) return;
      const params = new URLSearchParams();
      if (section !== "details") {
        params.set("section", section);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, syncUrl],
  );

  const [tabSection, setTabSection] = useState<JobCardSection>(initialSection);

  useEffect(() => {
    if (mode !== "tabs") return;
    setTabSection(initialSection);
  }, [initialSection, mode]);

  const scrollSpy = useSectionScrollSpy({
    sections: JOB_CARD_SECTIONS,
    idPrefix: SECTION_ID_PREFIX,
    initialSection,
    onNavigate: syncUrl ? syncSectionToUrl : undefined,
  });

  const scrollToSection = useCallback(
    (section: JobCardSection) => {
      if (mode === "tabs") {
        setTabSection(section);
        syncSectionToUrl(section);
        return;
      }
      scrollSpy.scrollToSection(section);
    },
    [mode, scrollSpy, syncSectionToUrl],
  );

  if (mode === "tabs") {
    return {
      activeSection: tabSection,
      scrollToSection,
      setSectionRef: (_section: JobCardSection) => (_node: HTMLElement | null) => {
        /* refs unused in tabs mode */
      },
      sections: JOB_CARD_SECTIONS,
    };
  }

  return {
    ...scrollSpy,
    sections: JOB_CARD_SECTIONS,
  };
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  sectionDomId,
  useSectionScrollSpy,
} from "@/hooks/use-section-scroll-spy";
import {
  JOB_CARD_SECTIONS,
  isJobCardSection,
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

function sectionUrl(pathname: string, section: JobCardSection) {
  const params = new URLSearchParams();
  if (section !== "details") {
    params.set("section", section);
  }
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

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
      const url = sectionUrl(pathname, section);
      if (mode === "tabs" && typeof window !== "undefined") {
        // Soft URL update — avoids remounting the job-card chrome via RSC.
        window.history.replaceState(window.history.state, "", url);
        return;
      }
      router.replace(url, { scroll: false });
    },
    [mode, pathname, router, syncUrl],
  );

  const [tabSection, setTabSection] = useState<JobCardSection>(initialSection);

  useEffect(() => {
    if (mode !== "tabs" || !syncUrl) return;
    const onPopState = () => {
      const raw = new URLSearchParams(window.location.search).get("section");
      setTabSection(isJobCardSection(raw) ? raw : "details");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [mode, syncUrl]);

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
      setSectionRef: () => () => {},
      sections: JOB_CARD_SECTIONS,
    };
  }

  return {
    ...scrollSpy,
    sections: JOB_CARD_SECTIONS,
  };
}

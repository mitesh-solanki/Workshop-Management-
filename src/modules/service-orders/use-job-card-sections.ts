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
  sections?: readonly JobCardSection[];
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
  sections = JOB_CARD_SECTIONS,
}: Options = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const allowed = sections;

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

  const [tabSection, setTabSection] = useState<JobCardSection>(() =>
    (allowed as readonly string[]).includes(initialSection)
      ? initialSection
      : (allowed[0] ?? "details"),
  );

  useEffect(() => {
    if (mode !== "tabs" || !syncUrl) return;
    const onPopState = () => {
      const raw = new URLSearchParams(window.location.search).get("section");
      setTabSection(
        raw && (allowed as readonly string[]).includes(raw)
          ? (raw as JobCardSection)
          : (allowed[0] ?? "details"),
      );
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [allowed, mode, syncUrl]);

  const scrollSpy = useSectionScrollSpy({
    sections: allowed,
    idPrefix: SECTION_ID_PREFIX,
    initialSection,
    onNavigate: syncUrl ? syncSectionToUrl : undefined,
  });

  const scrollToSection = useCallback(
    (section: JobCardSection) => {
      if (!(allowed as readonly string[]).includes(section)) return;
      if (mode === "tabs") {
        setTabSection(section);
        syncSectionToUrl(section);
        return;
      }
      scrollSpy.scrollToSection(section);
    },
    [allowed, mode, scrollSpy, syncSectionToUrl],
  );

  if (mode === "tabs") {
    return {
      activeSection: tabSection,
      scrollToSection,
      setSectionRef: () => () => {},
      sections: allowed,
    };
  }

  return {
    ...scrollSpy,
    sections: allowed,
  };
}

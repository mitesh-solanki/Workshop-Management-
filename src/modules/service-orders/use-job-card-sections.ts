"use client";

import { useCallback } from "react";
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
  /** Keep `?section=` in sync (edit page). */
  syncUrl?: boolean;
};

export function useJobCardSections({
  initialSection = "details",
  syncUrl = false,
}: Options = {}) {
  const router = useRouter();
  const pathname = usePathname();

  const onSectionChange = useCallback(
    (section: JobCardSection) => {
      if (!syncUrl) {
        return;
      }
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

  return useSectionScrollSpy({
    sections: JOB_CARD_SECTIONS,
    idPrefix: SECTION_ID_PREFIX,
    initialSection,
    onSectionChange: syncUrl ? onSectionChange : undefined,
  });
}

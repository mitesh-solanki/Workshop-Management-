"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { JobCardSection } from "@/modules/service-orders/job-card-sections";

const JobCardSectionJumpContext = createContext<
  ((section: JobCardSection) => void) | null
>(null);

export function JobCardSectionJumpProvider({
  onJump,
  children,
}: {
  onJump: (section: JobCardSection) => void;
  children: ReactNode;
}) {
  return (
    <JobCardSectionJumpContext.Provider value={onJump}>
      {children}
    </JobCardSectionJumpContext.Provider>
  );
}

export function useJobCardSectionJump() {
  return useContext(JobCardSectionJumpContext);
}

type JumpButtonProps = {
  section: JobCardSection;
  variant?: "default" | "outline" | "ghost" | "secondary";
  className?: string;
  children?: ReactNode;
};

export function JobCardSectionJumpButton({
  section,
  variant = "outline",
  className,
  children,
}: JumpButtonProps) {
  const jump = useJobCardSectionJump();
  const t = useTranslations("orders");

  if (!jump) return null;

  return (
    <Button
      type="button"
      variant={variant}
      size="md"
      className={className}
      onClick={() => jump(section)}
    >
      {children ?? t("details")}
    </Button>
  );
}

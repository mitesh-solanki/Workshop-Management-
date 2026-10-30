"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { InspectionApprovalStatus } from "@/modules/inspections/approval-status";

const VARIANT: Record<
  InspectionApprovalStatus,
  "secondary" | "warning" | "info" | "success" | "danger" | "outline"
> = {
  NONE: "secondary",
  NOT_REQUIRED: "outline",
  PENDING: "warning",
  PARTIAL: "info",
  APPROVED: "success",
  REJECTED: "danger",
};

type Props = {
  status: InspectionApprovalStatus;
};

export function InspectionApprovalBadge({ status }: Props) {
  const t = useTranslations("inspections");
  return (
    <Badge variant={VARIANT[status]}>{t(`approvalStatus.${status}`)}</Badge>
  );
}

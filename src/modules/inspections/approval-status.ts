export const INSPECTION_APPROVAL_STATUSES = [
  "NONE",
  "NOT_REQUIRED",
  "PENDING",
  "PARTIAL",
  "APPROVED",
  "REJECTED",
] as const;

export type InspectionApprovalStatus =
  (typeof INSPECTION_APPROVAL_STATUSES)[number];

type LineApproval = "PENDING" | "APPROVED" | "REJECTED";

/**
 * Customer approval summary for an inspection’s current estimate.
 * Any PENDING line keeps the whole inspection Pending.
 */
export function deriveInspectionApprovalStatus(input: {
  askPermission: boolean;
  lines: Array<{ approvalState: LineApproval }>;
} | null): InspectionApprovalStatus {
  if (!input || input.lines.length === 0) {
    return "NONE";
  }
  if (!input.askPermission) {
    return "NOT_REQUIRED";
  }

  let pending = 0;
  let approved = 0;
  let rejected = 0;
  for (const line of input.lines) {
    if (line.approvalState === "PENDING") pending += 1;
    else if (line.approvalState === "APPROVED") approved += 1;
    else rejected += 1;
  }

  if (pending > 0) return "PENDING";
  if (approved > 0 && rejected > 0) return "PARTIAL";
  if (approved > 0 && rejected === 0) return "APPROVED";
  if (rejected > 0 && approved === 0) return "REJECTED";
  return "PENDING";
}

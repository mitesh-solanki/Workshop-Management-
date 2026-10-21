import { sumLineGst, type EstimateTotals, type GstLineInput } from "@/lib/gst";

export type EstimateLineForTotals = GstLineInput & {
  approvalState: "PENDING" | "APPROVED" | "REJECTED";
};

export type PartialApprovalTotals = {
  all: EstimateTotals;
  approved: EstimateTotals;
  pending: EstimateTotals;
  rejected: EstimateTotals;
};

function filterByState(
  lines: readonly EstimateLineForTotals[],
  state: EstimateLineForTotals["approvalState"],
): GstLineInput[] {
  return lines
    .filter((line) => line.approvalState === state)
    .map(({ quantity, unitPricePaise, gstRatePercent }) => ({
      quantity,
      unitPricePaise,
      gstRatePercent,
    }));
}

/**
 * Full and partial-approval totals for an estimate.
 * GST is rounded per line, then summed (integer paise only).
 */
export function computeEstimateTotals(
  lines: readonly EstimateLineForTotals[],
): PartialApprovalTotals {
  const allInputs: GstLineInput[] = lines.map(
    ({ quantity, unitPricePaise, gstRatePercent }) => ({
      quantity,
      unitPricePaise,
      gstRatePercent,
    }),
  );

  return {
    all: sumLineGst(allInputs),
    approved: sumLineGst(filterByState(lines, "APPROVED")),
    pending: sumLineGst(filterByState(lines, "PENDING")),
    rejected: sumLineGst(filterByState(lines, "REJECTED")),
  };
}

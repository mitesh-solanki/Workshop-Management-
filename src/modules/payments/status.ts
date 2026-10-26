export type PaymentStatusValue = "PENDING" | "PAID" | "FAILED";

/** Badge variant for invoice payment list rows (PENDING UPI vs recorded). */
export function paymentStatusBadgeVariant(
  status: PaymentStatusValue,
): "warning" | "success" | "danger" {
  if (status === "PENDING") return "warning";
  if (status === "FAILED") return "danger";
  return "success";
}

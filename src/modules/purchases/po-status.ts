import type { PurchaseOrderStatus } from "@prisma/client";

export function purchaseOrderStatusFromLines(
  lines: Array<{ quantityOrdered: number; quantityReceived: number }>,
): PurchaseOrderStatus {
  if (lines.length === 0) {
    return "PENDING";
  }
  const allReceived = lines.every(
    (line) => line.quantityReceived >= line.quantityOrdered,
  );
  if (allReceived) {
    return "RECEIVED";
  }
  const anyReceived = lines.some((line) => line.quantityReceived > 0);
  if (anyReceived) {
    return "PARTIALLY_RECEIVED";
  }
  return "PENDING";
}

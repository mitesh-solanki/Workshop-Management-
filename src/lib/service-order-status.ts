/** Service order statuses used by status colour tokens in globals.css. */
export const SERVICE_ORDER_STATUSES = [
  "WAITING",
  "INSPECTION",
  "IN_PROGRESS",
  "WAITING_FOR_PARTS",
  "READY",
  "COMPLETED",
] as const;

export type ServiceOrderStatus = (typeof SERVICE_ORDER_STATUSES)[number];

export const serviceOrderStatusClass: Record<ServiceOrderStatus, string> = {
  WAITING: "border-transparent bg-status-waiting/20 text-status-waiting",
  INSPECTION:
    "border-transparent bg-status-inspection/15 text-status-inspection",
  IN_PROGRESS:
    "border-transparent bg-status-in-progress/15 text-status-in-progress",
  WAITING_FOR_PARTS:
    "border-transparent bg-status-waiting-parts/20 text-status-waiting-parts",
  READY: "border-transparent bg-status-ready/15 text-status-ready",
  COMPLETED:
    "border-transparent bg-status-completed/20 text-status-completed",
};

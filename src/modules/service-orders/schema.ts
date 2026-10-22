import { z } from "zod";
import { rupeesToPaiseSchema } from "@/lib/money";

export const SERVICE_ORDER_STATUSES = [
  "WAITING",
  "INSPECTION",
  "IN_PROGRESS",
  "WAITING_FOR_PARTS",
  "READY",
  "COMPLETED",
] as const;

export type ServiceOrderStatusValue = (typeof SERVICE_ORDER_STATUSES)[number];

export const SERVICE_ORDER_PRIORITIES = [
  "LOW",
  "NORMAL",
  "HIGH",
  "URGENT",
] as const;

export type ServiceOrderPriorityValue =
  (typeof SERVICE_ORDER_PRIORITIES)[number];

/** Lower number = higher urgency (for board card sort). */
export const PRIORITY_RANK: Record<ServiceOrderPriorityValue, number> = {
  URGENT: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};

/** Active board columns (excludes terminal Completed for phone switcher default). */
export const BOARD_STATUSES = SERVICE_ORDER_STATUSES;

export type BayOccupancy = {
  bay: string;
  count: number;
  registrationNumbers: string[];
};

export function computeBayOccupancy(
  orders: ReadonlyArray<{
    bay: string | null;
    status: ServiceOrderStatusValue;
    vehicle: { registrationNumber: string };
  }>,
): BayOccupancy[] {
  const byBay = new Map<string, BayOccupancy>();

  for (const order of orders) {
    if (!order.bay || order.status === "COMPLETED") {
      continue;
    }
    const existing = byBay.get(order.bay) ?? {
      bay: order.bay,
      count: 0,
      registrationNumbers: [],
    };
    existing.count += 1;
    existing.registrationNumbers.push(order.vehicle.registrationNumber);
    byBay.set(order.bay, existing);
  }

  return [...byBay.values()].sort((a, b) => a.bay.localeCompare(b.bay));
}

/** Counts orders per status for dashboard tiles. */
export function countOrdersByStatus(
  orders: ReadonlyArray<{ status: ServiceOrderStatusValue }>,
): Record<ServiceOrderStatusValue, number> {
  const counts = Object.fromEntries(
    SERVICE_ORDER_STATUSES.map((status) => [status, 0]),
  ) as Record<ServiceOrderStatusValue, number>;

  for (const order of orders) {
    counts[order.status] += 1;
  }
  return counts;
}

/** Allowed next statuses from each current status. COMPLETED is terminal. */
export const STATUS_TRANSITIONS: Record<
  ServiceOrderStatusValue,
  readonly ServiceOrderStatusValue[]
> = {
  WAITING: ["INSPECTION", "IN_PROGRESS"],
  INSPECTION: ["WAITING", "IN_PROGRESS", "WAITING_FOR_PARTS"],
  IN_PROGRESS: ["INSPECTION", "WAITING_FOR_PARTS", "READY"],
  WAITING_FOR_PARTS: ["IN_PROGRESS", "READY"],
  READY: ["IN_PROGRESS", "COMPLETED"],
  COMPLETED: [],
};

export function canTransitionStatus(
  from: ServiceOrderStatusValue,
  to: ServiceOrderStatusValue,
): boolean {
  if (from === to) {
    return false;
  }
  return STATUS_TRANSITIONS[from].includes(to);
}

const optionalOdometer = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value, ctx) => {
    if (value == null || value === "") {
      return null;
    }
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(n) || n < 0 || n > 9_999_999) {
      ctx.addIssue({ code: "custom", message: "validation.invalidOdometer" });
      return z.NEVER;
    }
    return n;
  });

const optionalDateTime = z
  .union([z.string(), z.date(), z.null(), z.undefined()])
  .transform((value, ctx) => {
    if (value == null || value === "") {
      return null;
    }
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        ctx.addIssue({ code: "custom", message: "validation.invalidDate" });
        return z.NEVER;
      }
      return value;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      ctx.addIssue({ code: "custom", message: "validation.invalidDate" });
      return z.NEVER;
    }
    return parsed;
  });

const optionalTechnicianId = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value == null || value === "") {
      return null;
    }
    return value.trim();
  });

const optionalBay = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value == null) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed.slice(0, 40);
  });

const optionalRequestedServices = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value == null) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed.slice(0, 2000);
  });

const quantityField = z
  .union([z.string(), z.number()])
  .transform((value, ctx) => {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 99_999) {
      ctx.addIssue({ code: "custom", message: "validation.invalidQuantity" });
      return z.NEVER;
    }
    return n;
  });

const priorityField = z
  .union([z.enum(SERVICE_ORDER_PRIORITIES), z.literal("")])
  .optional()
  .transform((value) => {
    if (value == null || value === "") {
      return "NORMAL" as const;
    }
    return value;
  });

export const createServiceOrderSchema = z.object({
  vehicleId: z.string().trim().min(1),
  complaint: z.string().trim().min(1).max(4000),
  requestedServices: optionalRequestedServices,
  odometerIn: optionalOdometer,
  expectedCompletion: optionalDateTime,
  technicianId: optionalTechnicianId,
  bay: optionalBay,
  priority: priorityField,
});

export const updateServiceOrderStatusSchema = z.object({
  status: z.enum(SERVICE_ORDER_STATUSES),
});

/** Editable job-card fields (customer/vehicle stay fixed after create). */
export const updateServiceOrderSchema = z.object({
  complaint: z.string().trim().min(1).max(4000),
  requestedServices: optionalRequestedServices,
  odometerIn: optionalOdometer,
  expectedCompletion: optionalDateTime,
  technicianId: optionalTechnicianId,
  bay: optionalBay,
  priority: priorityField,
  /** Optional — same as current status means no transition. */
  status: z
    .union([z.enum(SERVICE_ORDER_STATUSES), z.literal(""), z.undefined()])
    .transform((value) => (value === "" || value == null ? undefined : value)),
});

export const addServiceOrderLineSchema = z.object({
  type: z.enum(["LABOUR", "PART"]),
  description: z.string().trim().min(1).max(500),
  quantity: quantityField,
  unitPricePaise: rupeesToPaiseSchema,
  partId: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (value == null || value === "") {
        return null;
      }
      return value.trim();
    }),
});

export type CreateServiceOrderInput = z.input<typeof createServiceOrderSchema>;
export type UpdateServiceOrderInput = z.input<typeof updateServiceOrderSchema>;
export type UpdateServiceOrderStatusInput = z.input<
  typeof updateServiceOrderStatusSchema
>;
export type AddServiceOrderLineInput = z.input<typeof addServiceOrderLineSchema>;

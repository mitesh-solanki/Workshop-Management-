import { z } from "zod";

export const SERVICE_ORDER_STATUSES = [
  "WAITING",
  "INSPECTION",
  "IN_PROGRESS",
  "WAITING_FOR_PARTS",
  "READY",
  "COMPLETED",
] as const;

export type ServiceOrderStatusValue = (typeof SERVICE_ORDER_STATUSES)[number];

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
      ctx.addIssue({ code: "custom", message: "Invalid odometer" });
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
        ctx.addIssue({ code: "custom", message: "Invalid date" });
        return z.NEVER;
      }
      return value;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      ctx.addIssue({ code: "custom", message: "Invalid date" });
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

/** Rupee input (string/number) → integer paise. */
const unitPriceRupeesToPaise = z
  .union([z.string(), z.number()])
  .transform((value, ctx) => {
    const raw = typeof value === "number" ? String(value) : value.trim();
    if (raw === "") {
      return 0;
    }
    if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
      ctx.addIssue({ code: "custom", message: "Invalid price" });
      return z.NEVER;
    }
    const [rupeesPart, paisePart = ""] = raw.split(".");
    const rupees = Number(rupeesPart);
    const paise = paisePart.padEnd(2, "0").slice(0, 2);
    const total = rupees * 100 + Number(paise);
    if (!Number.isInteger(total) || total < 0) {
      ctx.addIssue({ code: "custom", message: "Invalid price" });
      return z.NEVER;
    }
    return total;
  });

const quantityField = z
  .union([z.string(), z.number()])
  .transform((value, ctx) => {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 99_999) {
      ctx.addIssue({ code: "custom", message: "Invalid quantity" });
      return z.NEVER;
    }
    return n;
  });

export const createServiceOrderSchema = z.object({
  vehicleId: z.string().trim().min(1),
  complaint: z.string().trim().min(1).max(4000),
  requestedServices: optionalRequestedServices,
  odometerIn: optionalOdometer,
  expectedCompletion: optionalDateTime,
  technicianId: optionalTechnicianId,
  bay: optionalBay,
});

export const updateServiceOrderStatusSchema = z.object({
  status: z.enum(SERVICE_ORDER_STATUSES),
});

export const addServiceOrderLineSchema = z.object({
  type: z.enum(["LABOUR", "PART"]),
  description: z.string().trim().min(1).max(500),
  quantity: quantityField,
  unitPricePaise: unitPriceRupeesToPaise,
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
export type UpdateServiceOrderStatusInput = z.input<
  typeof updateServiceOrderStatusSchema
>;
export type AddServiceOrderLineInput = z.input<typeof addServiceOrderLineSchema>;

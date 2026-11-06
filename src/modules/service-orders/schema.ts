import { z } from "zod";
import { rupeesToPaiseSchema } from "@/lib/money";
import { VEHICLE_ODOMETER_MAX } from "@/modules/vehicles/schema";

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

/** Job card status field may set any status; board still uses STATUS_TRANSITIONS for next steps. */
export function canTransitionStatus(
  from: ServiceOrderStatusValue,
  to: ServiceOrderStatusValue,
): boolean {
  return from !== to;
}

const optionalOdometer = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value, ctx) => {
    if (value == null || value === "") {
      return null;
    }
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(n) || n < 0 || n > VEHICLE_ODOMETER_MAX) {
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
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    const parsed = dateOnly
      ? new Date(
          Number(dateOnly[1]),
          Number(dateOnly[2]) - 1,
          Number(dateOnly[3]),
          23,
          59,
          59,
          999,
        )
      : new Date(value);
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

/** One or more technician user ids (empty = unassigned). */
const technicianIdsField = z
  .union([z.array(z.string()), z.string(), z.null(), z.undefined()])
  .transform((value) => {
    const raw =
      value == null
        ? []
        : Array.isArray(value)
          ? value
          : value === ""
            ? []
            : [value];
    return [
      ...new Set(
        raw
          .map((id) => id.trim())
          .filter((id) => id.length > 0),
      ),
    ];
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

/** Complaint lives on Inspection; job card keeps the column for legacy rows. */
const optionalComplaint = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value == null) {
      return "";
    }
    return value.trim().slice(0, 4000);
  });

const jobCardNumberField = z.coerce
  .number({ error: "validation.required" })
  .int({ error: "validation.invalidJobCardNumber" })
  .min(1, { error: "validation.invalidJobCardNumber" })
  .max(2_147_483_647, { error: "validation.invalidJobCardNumber" });

export const createServiceOrderSchema = z.object({
  vehicleId: z.string().trim().min(1),
  jobCardNumber: jobCardNumberField,
  complaint: optionalComplaint,
  requestedServices: optionalRequestedServices,
  odometerIn: optionalOdometer,
  expectedCompletion: optionalDateTime,
  technicianIds: technicianIdsField,
  /** @deprecated Prefer technicianIds — kept for older form posts. */
  technicianId: optionalTechnicianId.optional(),
  bay: optionalBay,
  priority: priorityField,
  status: z
    .union([z.enum(SERVICE_ORDER_STATUSES), z.literal(""), z.undefined()])
    .optional()
    .transform((value, ctx) => {
      if (value == null || value === "") {
        return "IN_PROGRESS" as const;
      }
      if (value === "WAITING") {
        ctx.addIssue({ code: "custom", message: "validation.invalidStatus" });
        return z.NEVER;
      }
      return value;
    }),
  inspectionId: z
    .union([z.string(), z.null(), z.undefined()])
    .optional()
    .transform((value) => {
      if (value == null || value === "") {
        return null;
      }
      return value.trim();
    }),
}).transform((data) => {
  const fromLegacy =
    data.technicianIds.length === 0 && data.technicianId
      ? [data.technicianId]
      : data.technicianIds;
  return {
    ...data,
    technicianIds: fromLegacy,
  };
});

export const updateServiceOrderStatusSchema = z.object({
  status: z.enum(SERVICE_ORDER_STATUSES),
});

/** Editable job-card fields (customer/vehicle stay fixed after create). */
export const updateServiceOrderSchema = z
  .object({
    jobCardNumber: jobCardNumberField,
    complaint: optionalComplaint,
    requestedServices: optionalRequestedServices,
    odometerIn: optionalOdometer,
    expectedCompletion: optionalDateTime,
    technicianIds: technicianIdsField,
    /** @deprecated Prefer technicianIds — kept for older form posts. */
    technicianId: optionalTechnicianId.optional(),
    bay: optionalBay,
    priority: priorityField,
    /** Optional — same as current status means no transition. */
    status: z
      .union([z.enum(SERVICE_ORDER_STATUSES), z.literal(""), z.undefined()])
      .transform((value) =>
        value === "" || value == null ? undefined : value,
      ),
  })
  .transform((data) => {
    const fromLegacy =
      data.technicianIds.length === 0 && data.technicianId
        ? [data.technicianId]
        : data.technicianIds;
    return {
      ...data,
      technicianIds: fromLegacy,
    };
  });

export const SERVICE_ORDER_LINE_TYPES = ["LABOUR", "PART", "OUTSIDE"] as const;
export const OUTSIDE_WORK_GST_SPLITS = ["CGST_SGST", "IGST"] as const;
export type OutsideWorkGstSplit = (typeof OUTSIDE_WORK_GST_SPLITS)[number];

export const MAX_OUTSIDE_WORK_BILL_BYTES = 8 * 1024 * 1024;
const OUTSIDE_WORK_BILL_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const optionalIdField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value == null || value === "") {
      return null;
    }
    return value.trim();
  });

const outsideGstRateField = z.preprocess(
  (value) => {
    if (value == null || value === "") return null;
    return typeof value === "number" ? value : Number(value);
  },
  z
    .number()
    .int()
    .refine((rate) => [0, 5, 12, 18, 28].includes(rate), {
      error: "validation.invalidInput",
    })
    .nullable(),
);

export const addServiceOrderLineSchema = z
  .object({
    type: z.enum(SERVICE_ORDER_LINE_TYPES),
    description: z.string().trim().min(1).max(500),
    quantity: quantityField,
    unitPricePaise: rupeesToPaiseSchema,
    partId: optionalIdField,
    vendorId: optionalIdField,
    gstSplit: z
      .union([z.enum(OUTSIDE_WORK_GST_SPLITS), z.literal(""), z.null(), z.undefined()])
      .transform((value) => {
        if (value == null || value === "") return null;
        return value;
      }),
    gstRatePercent: outsideGstRateField,
  })
  .superRefine((data, ctx) => {
    if (data.type !== "OUTSIDE") return;
    if (!data.vendorId) {
      ctx.addIssue({
        code: "custom",
        path: ["vendorId"],
        message: "validation.required",
      });
    }
    if (!data.gstSplit) {
      ctx.addIssue({
        code: "custom",
        path: ["gstSplit"],
        message: "validation.required",
      });
    }
    if (data.gstRatePercent == null) {
      ctx.addIssue({
        code: "custom",
        path: ["gstRatePercent"],
        message: "validation.required",
      });
    }
  });

export const updateServiceOrderLineSchema = z.object({
  description: z.string().trim().min(1).max(500),
  quantity: quantityField,
  unitPricePaise: rupeesToPaiseSchema,
  partId: optionalIdField.optional(),
  vendorId: optionalIdField.optional(),
  gstSplit: z
    .union([z.enum(OUTSIDE_WORK_GST_SPLITS), z.literal(""), z.null(), z.undefined()])
    .transform((value) => {
      if (value == null || value === "") return undefined;
      return value;
    })
    .optional(),
  gstRatePercent: z.preprocess(
    (value) => {
      if (value == null || value === "") return undefined;
      return typeof value === "number" ? value : Number(value);
    },
    z
      .number()
      .int()
      .refine((rate) => [0, 5, 12, 18, 28].includes(rate), {
        error: "validation.invalidInput",
      })
      .optional(),
  ),
  clearBill: z
    .union([z.boolean(), z.literal("1"), z.literal("true"), z.literal(""), z.null(), z.undefined()])
    .transform((value) => value === true || value === "1" || value === "true")
    .optional(),
});

const outsideBillByteSizeField = z
  .union([z.string(), z.number()])
  .transform((value, ctx) => {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(n) || n < 1) {
      ctx.addIssue({ code: "custom", message: "validation.invalidInput" });
      return z.NEVER;
    }
    return n;
  });

const optionalOutsideBillFileName = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null));

export const createOutsideWorkBillUploadUrlSchema = z.object({
  serviceOrderId: z.string().trim().min(1),
  lineId: z.string().trim().min(1),
  contentType: z.string().trim().min(3).max(120),
  byteSize: outsideBillByteSizeField,
  fileName: optionalOutsideBillFileName,
});

export const confirmOutsideWorkBillSchema = z.object({
  serviceOrderId: z.string().trim().min(1),
  lineId: z.string().trim().min(1),
  storageKey: z.string().trim().min(1).max(500),
  contentType: z.string().trim().min(3).max(120),
  byteSize: outsideBillByteSizeField,
  fileName: optionalOutsideBillFileName,
});

export function assertOutsideWorkBillLimits(
  contentType: string,
  byteSize: number,
) {
  if (!OUTSIDE_WORK_BILL_TYPES.has(contentType.toLowerCase())) {
    throw new Error("orders.outside_work_bill_type");
  }
  if (byteSize > MAX_OUTSIDE_WORK_BILL_BYTES) {
    throw new Error("orders.outside_work_bill_too_large");
  }
}

export const MAX_PAPER_COPY_BYTES = 8 * 1024 * 1024;
export const MAX_PAPER_COPIES_PER_ORDER = 5;

const PAPER_COPY_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const paperByteSizeField = z
  .union([z.string(), z.number()])
  .transform((value, ctx) => {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(n) || n < 1) {
      ctx.addIssue({ code: "custom", message: "validation.invalidInput" });
      return z.NEVER;
    }
    return n;
  });

export const createPaperCopyUploadUrlSchema = z.object({
  serviceOrderId: z.string().trim().min(1),
  contentType: z.string().trim().min(3).max(120),
  byteSize: paperByteSizeField,
  fileName: z
    .string()
    .trim()
    .max(255)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  /** When set, the upload replaces this copy and does not count toward the limit. */
  replacePaperCopyId: z
    .string()
    .trim()
    .min(1)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
});

export const confirmPaperCopySchema = z.object({
  serviceOrderId: z.string().trim().min(1),
  storageKey: z.string().trim().min(1).max(500),
  contentType: z.string().trim().min(3).max(120),
  byteSize: paperByteSizeField,
  fileName: z
    .string()
    .trim()
    .max(255)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
});

export const replacePaperCopySchema = z.object({
  serviceOrderId: z.string().trim().min(1),
  paperCopyId: z.string().trim().min(1),
  storageKey: z.string().trim().min(1).max(500),
  contentType: z.string().trim().min(3).max(120),
  byteSize: paperByteSizeField,
  fileName: z
    .string()
    .trim()
    .max(255)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
});

export const removePaperCopySchema = z.object({
  serviceOrderId: z.string().trim().min(1),
  paperCopyId: z.string().trim().min(1),
});

export function assertPaperCopyLimits(contentType: string, byteSize: number) {
  if (!PAPER_COPY_TYPES.has(contentType.toLowerCase())) {
    throw new Error("orders.paper_copy_type");
  }
  if (byteSize > MAX_PAPER_COPY_BYTES) {
    throw new Error("orders.paper_copy_too_large");
  }
}

export type CreateServiceOrderInput = z.input<typeof createServiceOrderSchema>;
export type UpdateServiceOrderInput = z.input<typeof updateServiceOrderSchema>;
export type UpdateServiceOrderStatusInput = z.input<
  typeof updateServiceOrderStatusSchema
>;
export type AddServiceOrderLineInput = z.input<typeof addServiceOrderLineSchema>;
export type UpdateServiceOrderLineInput = z.input<
  typeof updateServiceOrderLineSchema
>;
export type CreatePaperCopyUploadUrlInput = z.input<
  typeof createPaperCopyUploadUrlSchema
>;
export type ConfirmPaperCopyInput = z.input<typeof confirmPaperCopySchema>;
export type ReplacePaperCopyInput = z.input<typeof replacePaperCopySchema>;
export type RemovePaperCopyInput = z.input<typeof removePaperCopySchema>;
export type CreateOutsideWorkBillUploadUrlInput = z.input<
  typeof createOutsideWorkBillUploadUrlSchema
>;
export type ConfirmOutsideWorkBillInput = z.input<
  typeof confirmOutsideWorkBillSchema
>;

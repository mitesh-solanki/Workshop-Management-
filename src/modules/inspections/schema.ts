import { z } from "zod";
import { rupeesToPaiseSchema } from "@/lib/money";

/** @deprecated New inspections start empty; kept for older seeded rows / tests. */
export const DEFAULT_CHECKLIST_ITEMS = [
  { key: "brakes", label: "Brakes" },
  { key: "tyres", label: "Tyres" },
  { key: "battery", label: "Battery" },
  { key: "lights", label: "Lights" },
  { key: "fluids", label: "Fluids" },
  { key: "suspension", label: "Suspension" },
  { key: "ac", label: "AC" },
] as const;

export const INSPECTION_ITEM_RESULTS = [
  "OK",
  "NEEDS_ATTENTION",
  "URGENT",
] as const;

export type InspectionItemResultValue =
  (typeof INSPECTION_ITEM_RESULTS)[number];

export const MEDIA_KINDS = ["PHOTO", "VIDEO"] as const;
export type MediaKindValue = (typeof MEDIA_KINDS)[number];

export const SUGGESTED_REPAIR_TYPES = ["LABOUR", "PART"] as const;

export const INSPECTION_SORTS = [
  "newest",
  "oldest",
  "registration_asc",
  "registration_desc",
  "customer_asc",
] as const;

export type InspectionSort = (typeof INSPECTION_SORTS)[number];

export const inspectionSortSchema = z
  .enum(INSPECTION_SORTS)
  .default("newest");

const optionalNotes = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value == null) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed.slice(0, 2000);
  });

const optionalLongText = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value == null) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed.slice(0, 4000);
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

const optionalQuantityField = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value, ctx) => {
    if (value == null || value === "") {
      return undefined;
    }
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 99_999) {
      ctx.addIssue({ code: "custom", message: "Invalid quantity" });
      return z.NEVER;
    }
    return n;
  });

const optionalPriceField = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value, ctx) => {
    if (value == null) {
      return undefined;
    }
    if (value === "") {
      return 0;
    }
    // Numbers are already paise (e.g. Prisma / round-trip). Strings are rupees.
    if (typeof value === "number") {
      if (!Number.isInteger(value) || value < 0) {
        ctx.addIssue({ code: "custom", message: "Invalid price" });
        return z.NEVER;
      }
      return value;
    }
    const parsed = rupeesToPaiseSchema.safeParse(value);
    if (!parsed.success) {
      ctx.addIssue({ code: "custom", message: "Invalid price" });
      return z.NEVER;
    }
    return parsed.data;
  });

const optionalBoolField = z
  .union([z.boolean(), z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value == null || value === "") {
      return undefined;
    }
    if (typeof value === "boolean") {
      return value;
    }
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "on") {
      return true;
    }
    if (normalized === "false" || normalized === "0" || normalized === "off") {
      return false;
    }
    return undefined;
  });

export const createInspectionSchema = z.object({
  customerId: z.string().trim().min(1),
  vehicleId: z.string().trim().min(1),
});

export const updateInspectionNotesSchema = z.object({
  complaint: optionalLongText,
  recommendedNotes: optionalLongText,
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

const saveInspectionNoteLineSchema = z
  .object({
    note: z
      .union([z.string(), z.null(), z.undefined()])
      .optional()
      .transform((value) => {
        if (value == null) return "";
        return value.trim().slice(0, 500);
      }),
    quantity: quantityField.optional().transform((value) => {
      if (value == null) {
        return 1;
      }
      return value;
    }),
    /** Rupee form string, e.g. "244". Preferred. */
    unitPriceRupees: z.union([z.string(), z.null(), z.undefined()]).optional(),
    /**
     * Legacy key. Strings are rupees; numbers are already paise (do not convert
     * again — that caused 100× prices in PDF/DB).
     */
    unitPricePaise: z.union([z.string(), z.number(), z.null(), z.undefined()]).optional(),
  })
  .transform((data, ctx) => {
    let unitPricePaise = 0;
    if (data.unitPriceRupees != null && data.unitPriceRupees !== "") {
      const parsed = rupeesToPaiseSchema.safeParse(data.unitPriceRupees);
      if (!parsed.success) {
        ctx.addIssue({ code: "custom", message: "Invalid price" });
        return z.NEVER;
      }
      unitPricePaise = parsed.data;
    } else if (data.unitPricePaise != null && data.unitPricePaise !== "") {
      if (typeof data.unitPricePaise === "number") {
        if (
          !Number.isInteger(data.unitPricePaise) ||
          data.unitPricePaise < 0
        ) {
          ctx.addIssue({ code: "custom", message: "Invalid price" });
          return z.NEVER;
        }
        unitPricePaise = data.unitPricePaise;
      } else {
        const parsed = rupeesToPaiseSchema.safeParse(data.unitPricePaise);
        if (!parsed.success) {
          ctx.addIssue({ code: "custom", message: "Invalid price" });
          return z.NEVER;
        }
        unitPricePaise = parsed.data;
      }
    }
    return {
      note: data.note,
      quantity: data.quantity,
      unitPricePaise,
    };
  });

const saveInspectionItemSchema = z
  .object({
    id: z
      .union([z.string(), z.null(), z.undefined()])
      .optional()
      .transform((value) => {
        if (value == null) return null;
        const trimmed = value.trim();
        if (!trimmed || trimmed.startsWith("draft_")) return null;
        return trimmed;
      }),
    label: z.string().trim().min(1).max(120),
    result: z
      .union([z.enum(INSPECTION_ITEM_RESULTS), z.literal(""), z.null()])
      .optional()
      .transform((value) => (value === "" || value == null ? null : value)),
    externalCheck: z
      .union([z.boolean(), z.string(), z.null(), z.undefined()])
      .optional()
      .transform((value) => {
        if (value == null || value === "") return false;
        if (typeof value === "boolean") return value;
        const normalized = value.trim().toLowerCase();
        return (
          normalized === "true" || normalized === "1" || normalized === "on"
        );
      }),
    lines: z.array(saveInspectionNoteLineSchema).max(50).optional(),
    /** @deprecated Prefer lines — kept for older payloads. */
    notes: optionalNotes.optional(),
    quantity: optionalQuantityField.optional(),
    unitPricePaise: optionalPriceField.optional(),
  })
  .transform((data) => {
    const lines =
      data.lines && data.lines.length > 0
        ? data.lines.filter(
            (line) =>
              line.note.length > 0 ||
              line.quantity !== 1 ||
              line.unitPricePaise !== 0,
          )
        : data.notes
          ? [
              {
                note: data.notes,
                quantity: data.quantity ?? 1,
                unitPricePaise: data.unitPricePaise ?? 0,
              },
            ]
          : [];

    const quantity =
      lines.length > 0
        ? lines.reduce((sum, line) => sum + line.quantity, 0)
        : (data.quantity ?? 1);
    const unitPricePaise =
      lines.length > 0
        ? lines.reduce((sum, line) => sum + line.unitPricePaise, 0)
        : (data.unitPricePaise ?? 0);

    return {
      id: data.id,
      label: data.label,
      result: data.result,
      externalCheck: data.externalCheck,
      lines,
      notes:
        lines.length > 0
          ? JSON.stringify(lines)
          : null,
      quantity: quantity > 0 ? quantity : 1,
      unitPricePaise,
    };
  });

export const saveInspectionSchema = z.object({
  customerId: z.string().trim().min(1),
  vehicleId: z.string().trim().min(1),
  complaint: optionalLongText
    .optional()
    .transform((value) => value ?? null),
  recommendedNotes: optionalLongText
    .optional()
    .transform((value) => value ?? null),
  expectedCompletion: optionalDateTime
    .optional()
    .transform((value) => value ?? null),
  items: z.array(saveInspectionItemSchema).max(100),
});

export const saveInspectionItemsJsonSchema = z
  .string()
  .transform((raw, ctx) => {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      ctx.addIssue({ code: "custom", message: "Invalid items" });
      return z.NEVER;
    }
  })
  .pipe(z.array(saveInspectionItemSchema).max(100));

export const updateInspectionItemSchema = z.object({
  result: z
    .union([z.enum(INSPECTION_ITEM_RESULTS), z.literal(""), z.null()])
    .transform((value) => (value === "" || value == null ? null : value)),
  notes: optionalNotes,
  quantity: optionalQuantityField.optional(),
  unitPricePaise: optionalPriceField.optional(),
  externalCheck: optionalBoolField.optional(),
  label: z
    .union([z.string(), z.null(), z.undefined()])
    .optional()
    .transform((value) => {
      if (value == null) {
        return undefined;
      }
      const trimmed = value.trim();
      return trimmed === "" ? undefined : trimmed.slice(0, 120);
    }),
});

export const addChecklistItemSchema = z.object({
  label: z.string().trim().min(1).max(120),
});

export const addSuggestedRepairSchema = z
  .object({
    type: z.enum(SUGGESTED_REPAIR_TYPES),
    description: z.string().trim().max(500),
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
  })
  .superRefine((data, ctx) => {
    if (data.type === "PART") {
      if (!data.partId) {
        ctx.addIssue({
          code: "custom",
          path: ["partId"],
          message: "Part required",
        });
      }
      if (!data.description.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["description"],
          message: "Description required",
        });
      }
    } else if (!data.description.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["description"],
        message: "Description required",
      });
    }
  });

export const createUploadUrlSchema = z.object({
  inspectionItemId: z.string().trim().min(1),
  kind: z.enum(MEDIA_KINDS),
  contentType: z.string().trim().min(3).max(120),
  byteSize: z
    .union([z.string(), z.number()])
    .transform((value, ctx) => {
      const n = typeof value === "number" ? value : Number(value);
      if (!Number.isInteger(n) || n < 1) {
        ctx.addIssue({ code: "custom", message: "Invalid file size" });
        return z.NEVER;
      }
      return n;
    }),
});

export const confirmMediaSchema = z.object({
  inspectionItemId: z.string().trim().min(1),
  kind: z.enum(MEDIA_KINDS),
  storageKey: z.string().trim().min(1).max(500),
  contentType: z.string().trim().min(3).max(120),
  byteSize: z
    .union([z.string(), z.number()])
    .transform((value, ctx) => {
      const n = typeof value === "number" ? value : Number(value);
      if (!Number.isInteger(n) || n < 1) {
        ctx.addIssue({ code: "custom", message: "Invalid file size" });
        return z.NEVER;
      }
      return n;
    }),
});

/** Max photo size after browser compression (bytes). */
export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
/** Max short video size (bytes). */
export const MAX_VIDEO_BYTES = 25 * 1024 * 1024;

const PHOTO_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);
const VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"]);

export function assertMediaLimits(
  kind: MediaKindValue,
  contentType: string,
  byteSize: number,
) {
  if (kind === "PHOTO") {
    if (!PHOTO_TYPES.has(contentType.toLowerCase())) {
      throw new Error("Photos must be JPEG, PNG or WebP");
    }
    if (byteSize > MAX_PHOTO_BYTES) {
      throw new Error("Photo is too large after compression");
    }
    return;
  }
  if (!VIDEO_TYPES.has(contentType.toLowerCase())) {
    throw new Error("Videos must be MP4, MOV or WebM");
  }
  if (byteSize > MAX_VIDEO_BYTES) {
    throw new Error("Video is too large (max 25 MB)");
  }
}

export type CreateInspectionInput = z.input<typeof createInspectionSchema>;
export type UpdateInspectionNotesInput = z.input<
  typeof updateInspectionNotesSchema
>;
export type UpdateInspectionItemInput = z.input<
  typeof updateInspectionItemSchema
>;
export type SaveInspectionInput = z.input<typeof saveInspectionSchema>;
export type AddChecklistItemInput = z.input<typeof addChecklistItemSchema>;
export type AddSuggestedRepairInput = z.input<typeof addSuggestedRepairSchema>;
export type CreateUploadUrlInput = z.input<typeof createUploadUrlSchema>;
export type ConfirmMediaInput = z.input<typeof confirmMediaSchema>;

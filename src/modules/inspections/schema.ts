import { z } from "zod";

/** Default checklist keys seeded on a new inspection. */
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

const optionalNotes = z
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

export const updateInspectionItemSchema = z.object({
  result: z
    .union([z.enum(INSPECTION_ITEM_RESULTS), z.literal(""), z.null()])
    .transform((value) => (value === "" || value == null ? null : value)),
  notes: optionalNotes,
});

export const addChecklistItemSchema = z.object({
  label: z.string().trim().min(1).max(120),
});

export const addSuggestedRepairSchema = z.object({
  type: z.enum(SUGGESTED_REPAIR_TYPES),
  description: z.string().trim().min(1).max(500),
  quantity: quantityField,
  unitPricePaise: unitPriceRupeesToPaise,
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

export type UpdateInspectionItemInput = z.input<
  typeof updateInspectionItemSchema
>;
export type AddChecklistItemInput = z.input<typeof addChecklistItemSchema>;
export type AddSuggestedRepairInput = z.input<typeof addSuggestedRepairSchema>;
export type CreateUploadUrlInput = z.input<typeof createUploadUrlSchema>;
export type ConfirmMediaInput = z.input<typeof confirmMediaSchema>;

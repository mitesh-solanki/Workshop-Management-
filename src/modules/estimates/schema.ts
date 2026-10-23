import { z } from "zod";
import { rupeesToPaiseSchema } from "@/lib/money";

export const ESTIMATE_LINE_TYPES = ["LABOUR", "PART"] as const;
export type EstimateLineTypeValue = (typeof ESTIMATE_LINE_TYPES)[number];

export const ESTIMATE_APPROVAL_STATES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
] as const;
export type EstimateApprovalStateValue =
  (typeof ESTIMATE_APPROVAL_STATES)[number];

export const ESTIMATE_APPROVAL_METHODS = [
  "MANUAL",
  "PHONE",
  "WHATSAPP",
  "ONLINE",
] as const;
export type EstimateApprovalMethodValue =
  (typeof ESTIMATE_APPROVAL_METHODS)[number];

/** Common workshop GST rates in India (whole percent). */
export const GST_RATE_OPTIONS = [0, 5, 12, 18, 28] as const;

/** Default SAC for motor vehicle repair labour. */
export const DEFAULT_LABOUR_SAC = "998714";
/** Default HSN for generic automotive parts. */
export const DEFAULT_PART_HSN = "87089900";
export const DEFAULT_GST_RATE_PERCENT = 18;

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

const gstRateField = z
  .union([z.string(), z.number()])
  .transform((value, ctx) => {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(n) || n < 0 || n > 100) {
      ctx.addIssue({ code: "custom", message: "Invalid GST rate" });
      return z.NEVER;
    }
    return n;
  });

const hsnOrSacField = z
  .string()
  .trim()
  .min(2)
  .max(16)
  .regex(/^[0-9A-Za-z]+$/, "Invalid HSN/SAC code");

const optionalNotes = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value == null) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed.slice(0, 2000);
  });

export const createEstimateSchema = z.object({
  notes: optionalNotes.optional(),
});

export const createEstimateRevisionSchema = z.object({
  notes: optionalNotes.optional(),
  /** When true, also pull new order lines / suggested repairs not yet on the estimate. */
  includeNewSources: z
    .union([z.boolean(), z.string(), z.undefined()])
    .optional()
    .transform((value) => {
      if (value === true || value === "true" || value === "on" || value === "1") {
        return true;
      }
      return false;
    }),
});

export const addEstimateLineSchema = z.object({
  type: z.enum(ESTIMATE_LINE_TYPES),
  description: z.string().trim().min(1).max(500),
  quantity: quantityField,
  unitPricePaise: rupeesToPaiseSchema,
  gstRatePercent: gstRateField,
  hsnOrSac: hsnOrSacField,
});

export const setLineApprovalSchema = z.object({
  approvalState: z.enum(["APPROVED", "REJECTED", "PENDING"]),
  method: z.enum(ESTIMATE_APPROVAL_METHODS),
  note: optionalNotes,
});

export const updatePermissionLineSchema = z.object({
  description: z.string().trim().min(1).max(500),
  quantity: quantityField,
  unitPricePaise: rupeesToPaiseSchema,
  approvalState: z.enum(["APPROVED", "REJECTED", "PENDING"]),
  method: z.enum(ESTIMATE_APPROVAL_METHODS),
  note: optionalNotes,
});

export type CreateEstimateInput = z.input<typeof createEstimateSchema>;
export type CreateEstimateRevisionInput = z.input<
  typeof createEstimateRevisionSchema
>;
export type AddEstimateLineInput = z.input<typeof addEstimateLineSchema>;
export type SetLineApprovalInput = z.input<typeof setLineApprovalSchema>;
export type UpdatePermissionLineInput = z.input<
  typeof updatePermissionLineSchema
>;

export function defaultHsnOrSac(type: EstimateLineTypeValue): string {
  return type === "LABOUR" ? DEFAULT_LABOUR_SAC : DEFAULT_PART_HSN;
}

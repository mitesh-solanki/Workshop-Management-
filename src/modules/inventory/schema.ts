import { z } from "zod";
import { rupeesToPaiseSchema } from "@/lib/money";
import {
  DEFAULT_GST_RATE_PERCENT,
  DEFAULT_PART_HSN,
  GST_RATE_OPTIONS,
} from "@/modules/estimates/schema";

export { DEFAULT_GST_RATE_PERCENT, DEFAULT_PART_HSN, GST_RATE_OPTIONS };

export const STOCK_MOVEMENT_TYPES = ["IN", "OUT", "ADJUSTMENT"] as const;
export type StockMovementTypeValue = (typeof STOCK_MOVEMENT_TYPES)[number];

export const PART_UNIT_OPTIONS = [
  "pcs",
  "set",
  "pair",
  "litre",
  "ml",
  "kg",
  "g",
  "metre",
] as const;

export type PartUnitValue = (typeof PART_UNIT_OPTIONS)[number];

const quantityField = z
  .union([z.string(), z.number()])
  .transform((value, ctx) => {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 99_999) {
      ctx.addIssue({ code: "custom", message: "validation.invalidInput" });
      return z.NEVER;
    }
    return n;
  });

/** Signed non-zero integer for stock adjustments. */
const signedQuantityField = z
  .union([z.string(), z.number()])
  .transform((value, ctx) => {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(n) || n === 0 || n < -99_999 || n > 99_999) {
      ctx.addIssue({ code: "custom", message: "validation.invalidInput" });
      return z.NEVER;
    }
    return n;
  });

const lowStockField = z
  .union([z.string(), z.number()])
  .transform((value, ctx) => {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(n) || n < 0 || n > 99_999) {
      ctx.addIssue({ code: "custom", message: "validation.invalidInput" });
      return z.NEVER;
    }
    return n;
  });

const gstRateField = z
  .union([z.string(), z.number()])
  .transform((value, ctx) => {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(n) || n < 0 || n > 100) {
      ctx.addIssue({ code: "custom", message: "validation.invalidInput" });
      return z.NEVER;
    }
    return n;
  });

const hsnField = z
  .string()
  .trim()
  .min(2, { error: "validation.tooShort" })
  .max(16, { error: "validation.tooLong" })
  .regex(/^[0-9A-Za-z]+$/, { error: "validation.invalidInput" });

const skuField = z
  .string()
  .trim()
  .min(1, { error: "validation.required" })
  .max(64, { error: "validation.tooLong" })
  .transform((value) => value.toUpperCase().replace(/\s+/g, ""));

const unitField = z
  .string()
  .trim()
  .min(1, { error: "validation.required" })
  .max(20, { error: "validation.tooLong" });

const optionalNote = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value == null) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed.slice(0, 500);
  });

const optionalCustomerId = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value == null || value === "") {
      return null;
    }
    return value.trim();
  });

/** Optional search text; missing/empty becomes "". */
const searchQuery = z
  .string()
  .optional()
  .transform((value) => (value ?? "").trim().slice(0, 100));

export const partSearchSchema = z.object({
  q: searchQuery,
});

export const createPartSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "validation.required" })
    .max(200, { error: "validation.tooLong" }),
  sku: skuField,
  unit: unitField,
  purchasePricePaise: rupeesToPaiseSchema,
  sellingPricePaise: rupeesToPaiseSchema,
  gstRatePercent: gstRateField,
  hsn: hsnField,
  lowStockLevel: lowStockField,
  /** Optional opening stock (creates an IN movement in the same transaction). */
  openingStock: z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((value, ctx) => {
      if (value == null || value === "") {
        return 0;
      }
      const n = typeof value === "number" ? value : Number(value);
      if (!Number.isInteger(n) || n < 0 || n > 99_999) {
        ctx.addIssue({ code: "custom", message: "validation.invalidInput" });
        return z.NEVER;
      }
      return n;
    }),
});

export const updatePartSchema = createPartSchema.omit({ openingStock: true });

export const stockInSchema = z.object({
  partId: z.string().trim().min(1),
  quantity: quantityField,
  note: optionalNote,
});

export const stockOutSchema = z.object({
  partId: z.string().trim().min(1),
  quantity: quantityField,
  note: optionalNote,
});

export const stockAdjustSchema = z.object({
  partId: z.string().trim().min(1),
  quantityChange: signedQuantityField,
  note: optionalNote,
});

export const directSaleLineSchema = z.object({
  partId: z.string().trim().min(1),
  quantity: quantityField,
  unitPricePaise: rupeesToPaiseSchema,
});

export const createDirectSaleSchema = z.object({
  customerId: optionalCustomerId,
  notes: optionalNote,
  lines: z.array(directSaleLineSchema).min(1).max(50),
});

export type PartSearchInput = z.input<typeof partSearchSchema>;
export type CreatePartInput = z.input<typeof createPartSchema>;
export type UpdatePartInput = z.input<typeof updatePartSchema>;
export type StockInInput = z.input<typeof stockInSchema>;
export type StockOutInput = z.input<typeof stockOutSchema>;
export type StockAdjustInput = z.input<typeof stockAdjustSchema>;
export type CreateDirectSaleInput = z.input<typeof createDirectSaleSchema>;

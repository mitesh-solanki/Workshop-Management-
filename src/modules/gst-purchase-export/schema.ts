import { z } from "zod";

const yearMonthSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}$/, { error: "validation.invalidInput" });

export const purchaseGstExportListSchema = z.object({
  yearMonth: yearMonthSchema,
});

export const purchaseGstExportDownloadSchema = z.object({
  yearMonth: yearMonthSchema,
  rowIds: z
    .array(z.string().trim().min(1).max(96))
    .min(1, { error: "validation.invalidInput" })
    .max(2000, { error: "validation.invalidInput" }),
});

export type PurchaseGstExportListInput = z.input<
  typeof purchaseGstExportListSchema
>;
export type PurchaseGstExportDownloadInput = z.input<
  typeof purchaseGstExportDownloadSchema
>;

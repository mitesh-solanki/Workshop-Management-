import { z } from "zod";
import { partRequiresWarrantyCard } from "@/modules/warranties/part-requires-warranty";

export { partRequiresWarrantyCard };

const MAX_WARRANTY_BYTES = 8 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date")
  .transform((value) => {
    const date = new Date(`${value}T12:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
      throw new Error("Invalid date");
    }
    return date;
  });

const optionalDateOnlySchema = z
  .union([z.literal(""), z.undefined(), dateOnlySchema])
  .transform((value) => (value === "" || value == null ? null : value));

export const requestWarrantyUploadSchema = z.object({
  vehicleId: z.string().trim().min(1),
  contentType: z
    .string()
    .trim()
    .toLowerCase()
    .refine(
      (value): value is (typeof ALLOWED_CONTENT_TYPES)[number] =>
        (ALLOWED_CONTENT_TYPES as readonly string[]).includes(value),
      "Invalid file type",
    ),
  byteSize: z.number().int().positive().max(MAX_WARRANTY_BYTES),
  fileName: z.string().trim().min(1).max(200).optional(),
});

export type RequestWarrantyUploadInput = z.input<
  typeof requestWarrantyUploadSchema
>;

export const saveInvoiceLineWarrantySchema = z.object({
  invoiceId: z.string().trim().min(1),
  invoiceLineId: z.string().trim().min(1),
  warrantyExpiresAt: optionalDateOnlySchema.optional(),
  storageKey: z.string().trim().min(1).max(500).optional().nullable(),
  contentType: z.string().trim().max(100).optional().nullable(),
  byteSize: z.number().int().nonnegative().max(MAX_WARRANTY_BYTES).optional().nullable(),
  fileName: z.string().trim().max(200).optional().nullable(),
});

export type SaveInvoiceLineWarrantyInput = z.input<
  typeof saveInvoiceLineWarrantySchema
>;

export const createManualWarrantySchema = z.object({
  vehicleId: z.string().trim().min(1),
  partName: z.string().trim().min(1).max(200),
  invoiceId: z.string().trim().min(1).optional(),
  warrantyExpiresAt: optionalDateOnlySchema.optional(),
  storageKey: z.string().trim().min(1).max(500).optional().nullable(),
  contentType: z.string().trim().max(100).optional().nullable(),
  byteSize: z.number().int().nonnegative().max(MAX_WARRANTY_BYTES).optional().nullable(),
  fileName: z.string().trim().max(200).optional().nullable(),
});

export type CreateManualWarrantyInput = z.input<
  typeof createManualWarrantySchema
>;

export const deleteWarrantySchema = z.object({
  warrantyId: z.string().trim().min(1),
});

export type DeleteWarrantyInput = z.input<typeof deleteWarrantySchema>;

export { MAX_WARRANTY_BYTES, ALLOWED_CONTENT_TYPES };

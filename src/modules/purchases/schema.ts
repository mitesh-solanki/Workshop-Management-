import { z } from "zod";
import { parseRupeesToPaise } from "@/lib/money";

const optionalText = (max: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (value == null) {
        return null;
      }
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    })
    .refine((value) => value == null || value.length <= max, {
      error: "validation.tooLong",
    });

const optionalId = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value == null) return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  });

const rupeesField = z
  .union([z.string(), z.number()])
  .transform((value, ctx) => {
    const parsed = parseRupeesToPaise(value);
    if (parsed == null) {
      ctx.addIssue({ code: "custom", message: "validation.invalidInput" });
      return z.NEVER;
    }
    return parsed;
  });

export const createPartsRequestSchema = z.object({
  partId: z.string().trim().min(1, { error: "validation.required" }),
  quantity: z.coerce.number().int().min(1, { error: "validation.invalidInput" }),
  notes: optionalText(1000),
  serviceOrderId: optionalId,
  serviceOrderLineId: optionalId,
});

export const cancelPartsRequestSchema = z.object({
  requestId: z.string().trim().min(1, { error: "validation.required" }),
});

export const removeVendorBillAttachmentSchema = z.object({
  vendorBillId: z.string().trim().min(1, { error: "validation.required" }),
});

export const PARTS_REQUEST_STATUSES = ["OPEN", "ORDERED", "CANCELLED"] as const;

export const PARTS_REQUEST_SORTS = [
  "newest",
  "oldest",
  "part_asc",
  "part_desc",
] as const;

export type PartsRequestSort = (typeof PARTS_REQUEST_SORTS)[number];

export const partsRequestSearchSchema = z.object({
  q: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  status: z
    .enum(["ALL", ...PARTS_REQUEST_STATUSES])
    .default("ALL")
    .optional()
    .transform((v) => v ?? "ALL"),
  sort: z
    .enum(PARTS_REQUEST_SORTS)
    .default("newest")
    .optional()
    .transform((v) => v ?? "newest"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine((n) => [10, 20, 30, 40, 50].includes(n), {
      error: "validation.invalidInput",
    })
    .default(10),
});

export const createPurchaseOrderSchema = z.object({
  vendorId: z.string().trim().min(1, { error: "validation.required" }),
  notes: optionalText(1000),
  partsRequestIds: z
    .array(z.string().trim().min(1))
    .min(1, { error: "validation.required" }),
});

export const PURCHASE_ORDER_STATUSES = [
  "PENDING",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
] as const;

export const PURCHASE_ORDER_SORTS = ["newest", "oldest"] as const;
export type PurchaseOrderSort = (typeof PURCHASE_ORDER_SORTS)[number];

export const purchaseOrderSearchSchema = z.object({
  q: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  status: z
    .enum(["ALL", ...PURCHASE_ORDER_STATUSES])
    .default("ALL")
    .optional()
    .transform((v) => v ?? "ALL"),
  sort: z
    .enum(PURCHASE_ORDER_SORTS)
    .default("newest")
    .optional()
    .transform((v) => v ?? "newest"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine((n) => [10, 20, 30, 40, 50].includes(n), {
      error: "validation.invalidInput",
    })
    .default(10),
});

export const receiveGoodsSchema = z.object({
  purchaseOrderId: z.string().trim().min(1),
  notes: optionalText(1000),
  lines: z
    .array(
      z.object({
        purchaseOrderLineId: z.string().trim().min(1),
        quantity: z.coerce.number().int().min(0),
      }),
    )
    .min(1),
});

export const createVendorBillSchema = z.object({
  vendorId: z.string().trim().min(1, { error: "validation.required" }),
  purchaseOrderId: optionalId,
  billNumber: optionalText(80),
  billDate: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (value == null || String(value).trim() === "") {
        return new Date();
      }
      const d = new Date(String(value));
      if (Number.isNaN(d.getTime())) {
        return new Date();
      }
      return d;
    }),
  amountPaise: rupeesField.refine((v) => v > 0, {
    error: "validation.invalidInput",
  }),
  notes: optionalText(1000),
});

export const recordVendorBillPaymentSchema = z.object({
  vendorBillId: z.string().trim().min(1),
  amountPaise: rupeesField.refine((v) => v > 0, {
    error: "validation.invalidInput",
  }),
  method: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .default("CASH")
    .transform((v) => v || "CASH"),
  notes: optionalText(500),
});

export const VENDOR_BILL_SORTS = ["newest", "oldest"] as const;
export type VendorBillSort = (typeof VENDOR_BILL_SORTS)[number];

export const vendorBillSearchSchema = z.object({
  q: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  sort: z
    .enum(VENDOR_BILL_SORTS)
    .default("newest")
    .optional()
    .transform((v) => v ?? "newest"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine((n) => [10, 20, 30, 40, 50].includes(n), {
      error: "validation.invalidInput",
    })
    .default(10),
});

export const createPurchaseReturnSchema = z.object({
  vendorId: z.string().trim().min(1, { error: "validation.required" }),
  vendorBillId: optionalId,
  partId: z.string().trim().min(1, { error: "validation.required" }),
  quantity: z.coerce.number().int().min(1, { error: "validation.invalidInput" }),
  creditPaise: rupeesField.refine((v) => v >= 0, {
    error: "validation.invalidInput",
  }),
  notes: optionalText(1000),
});

export const PURCHASE_RETURN_SORTS = ["newest", "oldest"] as const;
export type PurchaseReturnSort = (typeof PURCHASE_RETURN_SORTS)[number];

export const purchaseReturnSearchSchema = z.object({
  q: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  sort: z
    .enum(PURCHASE_RETURN_SORTS)
    .default("newest")
    .optional()
    .transform((v) => v ?? "newest"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine((n) => [10, 20, 30, 40, 50].includes(n), {
      error: "validation.invalidInput",
    })
    .default(10),
});

export type CreatePartsRequestInput = z.input<typeof createPartsRequestSchema>;
export type CreatePurchaseOrderInput = z.input<typeof createPurchaseOrderSchema>;
export type ReceiveGoodsInput = z.input<typeof receiveGoodsSchema>;
export const MAX_VENDOR_BILL_ATTACHMENT_BYTES = 8 * 1024 * 1024;

const VENDOR_BILL_ATTACHMENT_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const byteSizeField = z
  .union([z.string(), z.number()])
  .transform((value, ctx) => {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(n) || n < 1) {
      ctx.addIssue({ code: "custom", message: "validation.invalidInput" });
      return z.NEVER;
    }
    return n;
  });

export const createVendorBillAttachmentUploadUrlSchema = z.object({
  vendorBillId: z.string().trim().min(1),
  contentType: z.string().trim().min(3).max(120),
  byteSize: byteSizeField,
  fileName: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export const confirmVendorBillAttachmentSchema = z.object({
  vendorBillId: z.string().trim().min(1),
  storageKey: z.string().trim().min(1).max(500),
  contentType: z.string().trim().min(3).max(120),
  byteSize: byteSizeField,
  fileName: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export function assertVendorBillAttachmentLimits(
  contentType: string,
  byteSize: number,
) {
  if (!VENDOR_BILL_ATTACHMENT_TYPES.has(contentType.toLowerCase())) {
    throw new Error("purchases.bill_attachment_type");
  }
  if (byteSize > MAX_VENDOR_BILL_ATTACHMENT_BYTES) {
    throw new Error("purchases.bill_attachment_too_large");
  }
}

export type CreateVendorBillInput = z.input<typeof createVendorBillSchema>;
export type RecordVendorBillPaymentInput = z.input<
  typeof recordVendorBillPaymentSchema
>;
export type CreatePurchaseReturnInput = z.input<
  typeof createPurchaseReturnSchema
>;
export type CreateVendorBillAttachmentUploadUrlInput = z.input<
  typeof createVendorBillAttachmentUploadUrlSchema
>;
export type ConfirmVendorBillAttachmentInput = z.input<
  typeof confirmVendorBillAttachmentSchema
>;

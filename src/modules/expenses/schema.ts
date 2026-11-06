import { z } from "zod";
import { rupeesToPaiseSchema } from "@/lib/money";
import { GST_RATE_OPTIONS } from "@/modules/estimates/schema";

/** Default category chips — suggestions only; any free-text category is allowed. */
export const EXPENSE_CATEGORY_SUGGESTIONS = [
  "Rent",
  "Electricity",
  "Water",
  "Fuel",
  "Tools",
  "Consumables",
  "Oil & Lubricants",
  "Tea & Snacks",
  "Cleaning",
  "Internet & Phone",
  "Insurance",
  "Shop Maintenance",
  "Uniforms",
  "Stationery",
  "Transport & Courier",
  "Security",
  "Software & Subscriptions",
  "CA & Accounting",
  "Bank Charges",
  "Advertising",
  "Training",
  "Waste Disposal",
  "Parking",
  "Miscellaneous",
] as const;

export const EXPENSE_METHODS = ["CASH", "UPI", "CARD"] as const;
export type ExpenseMethod = (typeof EXPENSE_METHODS)[number];

export const EXPENSE_STATUSES = ["PAID", "UNPAID"] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

export const EXPENSE_GST_SPLITS = ["CGST_SGST", "IGST"] as const;
export type ExpenseGstSplit = (typeof EXPENSE_GST_SPLITS)[number];

export const EXPENSE_SORTS = ["newest", "oldest", "amount_desc", "amount_asc"] as const;
export type ExpenseSort = (typeof EXPENSE_SORTS)[number];

export const MAX_EXPENSE_BILL_BYTES = 8 * 1024 * 1024;
const EXPENSE_BILL_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "validation.invalidDate" });

const optionalNote = z.preprocess(
  (value) => {
    if (value == null) return null;
    const trimmed = String(value).trim();
    return trimmed.length > 0 ? trimmed : null;
  },
  z
    .string()
    .max(500, { error: "validation.tooLong" })
    .nullable(),
);

const categorySchema = z
  .string()
  .trim()
  .min(1, { error: "validation.required" })
  .max(80, { error: "validation.tooLong" });

const optionalMethod = z.preprocess(
  (value) => {
    if (value == null) return null;
    const trimmed = String(value).trim();
    return trimmed.length > 0 ? trimmed : null;
  },
  z.enum(EXPENSE_METHODS).nullable(),
);

const gstRatePercentField = z.preprocess(
  (value) => {
    if (value == null || value === "") return 0;
    return typeof value === "number" ? value : Number(value);
  },
  z
    .number()
    .int()
    .refine((rate) => (GST_RATE_OPTIONS as readonly number[]).includes(rate), {
      error: "validation.invalidInput",
    }),
);

const optionalVendorId = z.preprocess(
  (value) => {
    if (value == null) return null;
    const trimmed = String(value).trim();
    return trimmed.length > 0 ? trimmed : null;
  },
  z
    .string()
    .min(1)
    .max(64)
    .nullable(),
);

export const createExpenseSchema = z
  .object({
    amountRupees: rupeesToPaiseSchema.refine((v) => v > 0, {
      error: "validation.amountMustBePositive",
    }),
    spentAt: dateOnlySchema,
    status: z.enum(EXPENSE_STATUSES, { error: "validation.required" }),
    method: optionalMethod,
    category: categorySchema,
    note: optionalNote,
    vendorId: optionalVendorId,
    gstSplit: z.enum(EXPENSE_GST_SPLITS).default("CGST_SGST"),
    gstRatePercent: gstRatePercentField,
  })
  .superRefine((data, ctx) => {
    if (data.status === "PAID" && !data.method) {
      ctx.addIssue({
        code: "custom",
        path: ["method"],
        message: "validation.required",
      });
    }
  });

export const updateExpenseSchema = createExpenseSchema;

const billByteSizeField = z
  .union([z.string(), z.number()])
  .transform((value, ctx) => {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(n) || n < 1) {
      ctx.addIssue({ code: "custom", message: "validation.invalidInput" });
      return z.NEVER;
    }
    return n;
  });

const optionalBillFileName = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null));

export const createExpenseBillUploadUrlSchema = z.object({
  expenseId: z.string().trim().min(1),
  contentType: z.string().trim().min(3).max(120),
  byteSize: billByteSizeField,
  fileName: optionalBillFileName,
});

export const confirmExpenseBillSchema = z.object({
  expenseId: z.string().trim().min(1),
  storageKey: z.string().trim().min(1).max(500),
  contentType: z.string().trim().min(3).max(120),
  byteSize: billByteSizeField,
  fileName: optionalBillFileName,
});

export function assertExpenseBillLimits(contentType: string, byteSize: number) {
  if (!EXPENSE_BILL_TYPES.has(contentType.toLowerCase())) {
    throw new Error("expenses.bill_type");
  }
  if (byteSize > MAX_EXPENSE_BILL_BYTES) {
    throw new Error("expenses.bill_too_large");
  }
}

export const deleteExpenseSchema = z.object({
  expenseId: z.string().trim().min(1, { error: "validation.required" }),
});

export const markExpensePaidSchema = z.object({
  expenseId: z.string().trim().min(1, { error: "validation.required" }),
  method: z.enum(EXPENSE_METHODS, { error: "validation.required" }),
  spentAt: dateOnlySchema.optional(),
});

export const expenseSortSchema = z.enum(EXPENSE_SORTS).default("newest");

export const EXPENSE_STATUS_FILTERS = ["ALL", ...EXPENSE_STATUSES] as const;
export type ExpenseStatusFilter = (typeof EXPENSE_STATUS_FILTERS)[number];

export const expenseSearchSchema = z.object({
  q: z
    .string()
    .trim()
    .max(120, { error: "validation.tooLong" })
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  category: z
    .string()
    .trim()
    .max(80, { error: "validation.tooLong" })
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  status: z
    .enum(EXPENSE_STATUS_FILTERS)
    .default("ALL")
    .optional()
    .transform((value) => value ?? "ALL"),
  sort: expenseSortSchema,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine((n) => [10, 20, 30, 40, 50].includes(n), {
      error: "validation.invalidInput",
    })
    .default(10),
});

export function filterExpenseCategorySuggestions(
  query: string,
  extra: readonly string[] = [],
): string[] {
  const q = query.trim().toLowerCase();
  const merged = [
    ...EXPENSE_CATEGORY_SUGGESTIONS,
    ...extra.map((value) => value.trim()).filter(Boolean),
  ];
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const item of merged) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  if (!q) return unique;
  return unique.filter((item) => item.toLowerCase().includes(q));
}

export type CreateExpenseInput = z.input<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.input<typeof updateExpenseSchema>;
export type MarkExpensePaidInput = z.input<typeof markExpensePaidSchema>;
export type ExpenseSearchInput = z.input<typeof expenseSearchSchema>;
export type CreateExpenseBillUploadUrlInput = z.input<
  typeof createExpenseBillUploadUrlSchema
>;
export type ConfirmExpenseBillInput = z.input<typeof confirmExpenseBillSchema>;

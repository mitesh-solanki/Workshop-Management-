import { z } from "zod";
import { rupeesToPaiseSchema } from "@/lib/money";

/** Default category chips — suggestions only; any free-text category is allowed. */
export const EXPENSE_CATEGORY_SUGGESTIONS = [
  "Rent",
  "Electricity",
  "Fuel",
  "Tools",
  "Tea & Snacks",
  "Miscellaneous",
] as const;

export const EXPENSE_METHODS = ["CASH", "UPI", "CARD"] as const;
export type ExpenseMethod = (typeof EXPENSE_METHODS)[number];

export const EXPENSE_STATUSES = ["PAID", "UNPAID"] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

export const EXPENSE_SORTS = ["newest", "oldest", "amount_desc", "amount_asc"] as const;
export type ExpenseSort = (typeof EXPENSE_SORTS)[number];

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
  if (!q) return unique.slice(0, 12);
  return unique
    .filter((item) => item.toLowerCase().includes(q))
    .slice(0, 12);
}

export type CreateExpenseInput = z.input<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.input<typeof updateExpenseSchema>;
export type MarkExpensePaidInput = z.input<typeof markExpensePaidSchema>;
export type ExpenseSearchInput = z.input<typeof expenseSearchSchema>;

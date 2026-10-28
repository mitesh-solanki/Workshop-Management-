import { z } from "zod";

export const BAY_NAME_MAX = 40;

export function normalizeBayName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export const createBaySchema = z.object({
  name: z.preprocess(
    (value) => normalizeBayName(String(value ?? "")),
    z
      .string()
      .min(1, { error: "validation.required" })
      .max(BAY_NAME_MAX, { error: "validation.tooLong" }),
  ),
});

export const BAY_SORTS = ["newest", "oldest", "name_asc", "name_desc"] as const;
export type BaySort = (typeof BAY_SORTS)[number];

export const baySortSchema = z.enum(BAY_SORTS).default("newest");

export const baySearchSchema = z.object({
  q: z
    .string()
    .trim()
    .max(120, { error: "validation.tooLong" })
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  sort: baySortSchema,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine((n) => [10, 20, 30, 40, 50].includes(n), {
      error: "validation.invalidInput",
    })
    .default(10),
});

export const updateBaySchema = createBaySchema;

export const deleteBaySchema = z.object({
  bayId: z.string().trim().min(1, { error: "validation.required" }),
});

export type CreateBayInput = z.input<typeof createBaySchema>;
export type UpdateBayInput = z.input<typeof updateBaySchema>;
export type BaySearchInput = z.input<typeof baySearchSchema>;

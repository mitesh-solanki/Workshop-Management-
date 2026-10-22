import { z } from "zod";

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

export const createCustomerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "validation.required" })
    .max(120, { error: "validation.tooLong" }),
  phone: z
    .string()
    .trim()
    .min(7, { error: "validation.tooShort" })
    .max(20, { error: "validation.tooLong" }),
  address: optionalText(500),
  notes: optionalText(2000),
});

export const updateCustomerSchema = createCustomerSchema;

export const customerSearchSchema = z.object({
  q: z
    .string()
    .trim()
    .max(120, { error: "validation.tooLong" })
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine((n) => [10, 20, 30, 40, 50].includes(n), {
      error: "validation.invalidInput",
    })
    .default(10),
});

/** Raw form/API values before transforms. */
export type CreateCustomerInput = z.input<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.input<typeof updateCustomerSchema>;
export type CustomerSearchInput = z.input<typeof customerSearchSchema>;
export type CustomerSearchParsed = z.output<typeof customerSearchSchema>;

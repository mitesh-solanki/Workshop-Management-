import { z } from "zod";
import { GSTIN_REGEX } from "@/lib/gstin";

const booleanFromForm = z
  .union([z.boolean(), z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (typeof value === "boolean") {
      return value;
    }
    if (value == null || value === "") {
      return false;
    }
    const normalized = String(value).toLowerCase();
    return normalized === "true" || normalized === "on" || normalized === "1";
  });

export const updateGarageSettingsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: "validation.tooShort" })
    .max(120, { error: "validation.tooLong" }),
  address: z
    .string()
    .trim()
    .max(500, { error: "validation.tooLong" })
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null))
    .refine((value) => value == null || GSTIN_REGEX.test(value), {
      error: "validation.invalidGstin",
    }),
  allowNegativeStock: booleanFromForm,
});

export type UpdateGarageSettingsInput = z.infer<typeof updateGarageSettingsSchema>;

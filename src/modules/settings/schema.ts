import { z } from "zod";
import { GSTIN_REGEX } from "@/lib/gstin";

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
});

export type UpdateGarageSettingsInput = z.infer<typeof updateGarageSettingsSchema>;

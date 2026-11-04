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
  nextJobCardNumber: z.coerce
    .number({ error: "validation.required" })
    .int({ error: "validation.invalidJobCardNumber" })
    .min(1, { error: "validation.invalidJobCardNumber" })
    .max(2_147_483_647, { error: "validation.invalidJobCardNumber" }),
});

export type UpdateGarageSettingsInput = z.input<typeof updateGarageSettingsSchema>;

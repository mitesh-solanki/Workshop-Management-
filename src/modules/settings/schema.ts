import { z } from "zod";

const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const updateGarageSettingsSchema = z.object({
  name: z.string().trim().min(2).max(120),
  address: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null))
    .refine((value) => value == null || gstinRegex.test(value), {
      message: "Invalid GSTIN",
    }),
});

export type UpdateGarageSettingsInput = z.infer<typeof updateGarageSettingsSchema>;

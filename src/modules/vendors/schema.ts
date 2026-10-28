import { z } from "zod";
import { isValidEmail, isValidPhone } from "@/lib/contact";
import { GSTIN_REGEX, normalizeGstin } from "@/lib/gstin";

function blankToNull(value: unknown): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

const optionalText = (max: number) =>
  z.preprocess(
    blankToNull,
    z
      .string()
      .max(max, { error: "validation.tooLong" })
      .nullable(),
  );

const optionalPhone = z.preprocess(
  blankToNull,
  z
    .string()
    .refine((value) => isValidPhone(value), {
      error: "validation.invalidPhone",
    })
    .nullable(),
);

const optionalEmail = z.preprocess(
  (value) => {
    const raw = blankToNull(value);
    return raw == null ? null : raw.toLowerCase();
  },
  z
    .string()
    .refine((value) => isValidEmail(value), {
      error: "validation.invalidEmail",
    })
    .nullable(),
);

const optionalGstin = z.preprocess(
  (value) => {
    const raw = blankToNull(value);
    return raw == null ? null : normalizeGstin(raw);
  },
  z
    .string()
    .refine((value) => GSTIN_REGEX.test(value), {
      error: "validation.invalidGstin",
    })
    .nullable(),
);

export const createVendorSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { error: "validation.required" })
      .max(160, { error: "validation.tooLong" }),
    phone: optionalPhone,
    email: optionalEmail,
    address: optionalText(500),
    gstin: optionalGstin,
    notes: optionalText(2000),
  })
  .refine((data) => Boolean(data.phone || data.email), {
    error: "validation.phoneOrEmail",
    path: ["phone"],
  });

export const updateVendorSchema = createVendorSchema;

export const deleteVendorSchema = z.object({
  vendorId: z.string().trim().min(1, { error: "validation.required" }),
});

export const VENDOR_SORTS = [
  "newest",
  "oldest",
  "name_asc",
  "name_desc",
] as const;
export type VendorSort = (typeof VENDOR_SORTS)[number];

export const vendorSortSchema = z.enum(VENDOR_SORTS).default("newest");

export const vendorSearchSchema = z.object({
  q: z
    .string()
    .trim()
    .max(120, { error: "validation.tooLong" })
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  sort: vendorSortSchema,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine((n) => [10, 20, 30, 40, 50].includes(n), {
      error: "validation.invalidInput",
    })
    .default(10),
});

export type CreateVendorInput = z.input<typeof createVendorSchema>;
export type UpdateVendorInput = z.input<typeof updateVendorSchema>;
export type VendorSearchInput = z.input<typeof vendorSearchSchema>;

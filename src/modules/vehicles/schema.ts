import { z } from "zod";
import { GST_STATE_CODES } from "@/lib/gstin";

/** Gujarat GST state code — default for new vehicles. */
export const DEFAULT_VEHICLE_STATE_CODE = "24" as const;

/** Uppercase registration with all whitespace removed. */
export function normaliseRegistration(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

const stateCodeField = z
  .union([z.string(), z.null(), z.undefined()])
  .optional()
  .transform((value, ctx) => {
    const raw =
      value == null || String(value).trim() === ""
        ? DEFAULT_VEHICLE_STATE_CODE
        : String(value).trim();
    if (!(GST_STATE_CODES as readonly string[]).includes(raw)) {
      ctx.addIssue({ code: "custom", message: "validation.invalidInput" });
      return z.NEVER;
    }
    return raw;
  });

const optionalDate = z
  .union([z.string(), z.date(), z.null(), z.undefined()])
  .transform((value, ctx) => {
    if (value == null || value === "") {
      return null;
    }
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        ctx.addIssue({ code: "custom", message: "validation.invalidDate" });
        return z.NEVER;
      }
      return value;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      ctx.addIssue({ code: "custom", message: "validation.invalidDate" });
      return z.NEVER;
    }
    return parsed;
  });

const optionalYear = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value, ctx) => {
    if (value == null || value === "") {
      return null;
    }
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(n) || n < 1950 || n > 2100) {
      ctx.addIssue({ code: "custom", message: "validation.invalidYear" });
      return z.NEVER;
    }
    return n;
  });

const optionalOdometer = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value, ctx) => {
    if (value == null || value === "") {
      return null;
    }
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(n) || n < 0 || n > 9_999_999) {
      ctx.addIssue({ code: "custom", message: "validation.invalidOdometer" });
      return z.NEVER;
    }
    return n;
  });

export const createVehicleSchema = z.object({
  customerId: z.string().trim().min(1, { error: "validation.required" }),
  registrationNumber: z
    .string()
    .trim()
    .min(1, { error: "validation.required" })
    .max(20, { error: "validation.tooLong" })
    .transform(normaliseRegistration)
    .refine((value) => value.length >= 4, {
      error: "validation.tooShort",
    }),
  make: z
    .string()
    .trim()
    .min(1, { error: "validation.required" })
    .max(80, { error: "validation.tooLong" }),
  model: z
    .string()
    .trim()
    .min(1, { error: "validation.required" })
    .max(80, { error: "validation.tooLong" }),
  stateCode: stateCodeField,
  year: optionalYear,
  odometer: optionalOdometer,
  insuranceExpiry: optionalDate,
  pucExpiry: optionalDate,
  fitnessExpiry: optionalDate,
});

export const updateVehicleSchema = createVehicleSchema.omit({ customerId: true });

export const VEHICLE_SORTS = [
  "newest",
  "updated",
  "name_asc",
  "name_desc",
] as const;
export type VehicleSort = (typeof VEHICLE_SORTS)[number];

export const vehicleSortSchema = z.enum(VEHICLE_SORTS).default("name_asc");

export const vehicleSearchSchema = z.object({
  q: z
    .string()
    .trim()
    .max(120, { error: "validation.tooLong" })
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  sort: vehicleSortSchema,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine((n) => [10, 20, 30, 40, 50].includes(n), {
      error: "validation.invalidInput",
    })
    .default(10),
});

/** Raw form/API values before transforms (strings allowed for numbers and dates). */
export type CreateVehicleInput = z.input<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.input<typeof updateVehicleSchema>;
export type VehicleSearchInput = z.input<typeof vehicleSearchSchema>;
export type VehicleSearchParsed = z.output<typeof vehicleSearchSchema>;

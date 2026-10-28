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

export const VEHICLE_YEAR_MIN = 1950;
/** Newest allowed model year: current calendar year + 1 (next-year registrations). */
export function getVehicleYearMax(): number {
  return new Date().getFullYear() + 1;
}

/** Realistic garage cap — under 1 million km. */
export const VEHICLE_ODOMETER_MAX = 999_999;
export const VEHICLE_ODOMETER_MAX_DIGITS = 6;

const optionalYear = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value, ctx) => {
    if (value == null || value === "") {
      return null;
    }
    const n = typeof value === "number" ? value : Number(value);
    const max = getVehicleYearMax();
    if (!Number.isInteger(n) || n < VEHICLE_YEAR_MIN || n > max) {
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
    if (!Number.isInteger(n) || n < 0 || n > VEHICLE_ODOMETER_MAX) {
      ctx.addIssue({ code: "custom", message: "validation.invalidOdometer" });
      return z.NEVER;
    }
    return n;
  });

/** Digits only, max 4 — for year typing. */
export function sanitizeYearTyping(value: string): string {
  return value.replace(/\D/g, "").slice(0, 4);
}

/** Digits only, max 6 — for odometer km typing. */
export function sanitizeOdometerTyping(value: string): string {
  return value.replace(/\D/g, "").slice(0, VEHICLE_ODOMETER_MAX_DIGITS);
}

/** Empty is ok; otherwise must be an integer year in range. */
export function isValidVehicleYearInput(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (!/^\d{4}$/.test(trimmed)) return false;
  const n = Number(trimmed);
  return (
    Number.isInteger(n) && n >= VEHICLE_YEAR_MIN && n <= getVehicleYearMax()
  );
}

/** Empty is ok; otherwise 0 … VEHICLE_ODOMETER_MAX. */
export function isValidVehicleOdometerInput(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (!/^\d{1,6}$/.test(trimmed)) return false;
  const n = Number(trimmed);
  return Number.isInteger(n) && n >= 0 && n <= VEHICLE_ODOMETER_MAX;
}

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
  "oldest",
  "updated",
  "name_asc",
  "name_desc",
] as const;
export type VehicleSort = (typeof VEHICLE_SORTS)[number];

export const vehicleSortSchema = z.enum(VEHICLE_SORTS).default("newest");

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

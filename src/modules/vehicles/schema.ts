import { z } from "zod";

/** Uppercase registration with all whitespace removed. */
export function normaliseRegistration(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

const optionalDate = z
  .union([z.string(), z.date(), z.null(), z.undefined()])
  .transform((value, ctx) => {
    if (value == null || value === "") {
      return null;
    }
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        ctx.addIssue({ code: "custom", message: "Invalid date" });
        return z.NEVER;
      }
      return value;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      ctx.addIssue({ code: "custom", message: "Invalid date" });
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
      ctx.addIssue({ code: "custom", message: "Invalid year" });
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
      ctx.addIssue({ code: "custom", message: "Invalid odometer" });
      return z.NEVER;
    }
    return n;
  });

export const createVehicleSchema = z.object({
  customerId: z.string().trim().min(1),
  registrationNumber: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .transform(normaliseRegistration)
    .refine((value) => value.length >= 4, {
      message: "Registration number is too short",
    }),
  make: z.string().trim().min(1).max(80),
  model: z.string().trim().min(1).max(80),
  year: optionalYear,
  odometer: optionalOdometer,
  insuranceExpiry: optionalDate,
  pucExpiry: optionalDate,
  fitnessExpiry: optionalDate,
});

export const updateVehicleSchema = createVehicleSchema.omit({ customerId: true });

/** Raw form/API values before transforms (strings allowed for numbers and dates). */
export type CreateVehicleInput = z.input<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.input<typeof updateVehicleSchema>;

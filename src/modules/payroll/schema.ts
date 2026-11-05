import { z } from "zod";
import { parseRupeesToPaise, rupeesToPaiseSchema } from "@/lib/money";

/** Rupee string that may be negative (manual payroll adjustment). */
const signedRupeesToPaiseSchema = z
  .union([z.string(), z.number()])
  .transform((value, ctx) => {
    const raw =
      typeof value === "number" ? String(value) : String(value).trim();
    if (raw === "" || raw === "-") return 0;
    const negative = raw.startsWith("-");
    const digits = negative ? raw.slice(1) : raw;
    const parsed = parseRupeesToPaise(digits);
    if (parsed == null) {
      ctx.addIssue({ code: "custom", message: "Invalid price" });
      return z.NEVER;
    }
    return negative ? -parsed : parsed;
  });

const paymentMethodSchema = z.enum(["CASH", "UPI", "CARD", "MIXED"]);
const payModeSchema = z.enum(["FULL_BASIC"]);

const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "invalidDate");

export const upsertPayProfileSchema = z.object({
  userId: z.string().trim().min(1),
  basicRupees: rupeesToPaiseSchema,
  payMode: payModeSchema.default("FULL_BASIC"),
});

export const giveAdvanceSchema = z.object({
  userId: z.string().trim().min(1),
  amountRupees: rupeesToPaiseSchema.refine((v) => v > 0, {
    message: "amountMustBePositive",
  }),
  givenOn: dateOnlySchema,
  method: paymentMethodSchema,
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export const updateAdvanceSchema = z.object({
  advanceId: z.string().trim().min(1),
  amountRupees: rupeesToPaiseSchema.refine((v) => v > 0, {
    message: "amountMustBePositive",
  }),
  givenOn: dateOnlySchema,
  method: paymentMethodSchema,
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export const deleteAdvanceSchema = z.object({
  advanceId: z.string().trim().min(1),
});

export const giveBonusSchema = z.object({
  userId: z.string().trim().min(1),
  amountRupees: rupeesToPaiseSchema.refine((v) => v > 0, {
    message: "amountMustBePositive",
  }),
  givenOn: dateOnlySchema,
  method: paymentMethodSchema,
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export const updateBonusSchema = z.object({
  bonusId: z.string().trim().min(1),
  amountRupees: rupeesToPaiseSchema.refine((v) => v > 0, {
    message: "amountMustBePositive",
  }),
  givenOn: dateOnlySchema,
  method: paymentMethodSchema,
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export const deleteBonusSchema = z.object({
  bonusId: z.string().trim().min(1),
});

export const createPayrollRunSchema = z
  .object({
    periodStart: dateOnlySchema,
    periodEnd: dateOnlySchema,
    lines: z
      .array(
        z.object({
          userId: z.string().trim().min(1),
          basicRupees: rupeesToPaiseSchema,
          note: z.string().trim().max(500).optional().or(z.literal("")),
        }),
      )
      .min(1)
      .max(200),
  })
  .superRefine((value, ctx) => {
    if (value.periodEnd < value.periodStart) {
      ctx.addIssue({
        code: "custom",
        path: ["periodEnd"],
        message: "periodEndBeforeStart",
      });
    }
  });

export const updatePayrollLineSchema = z.object({
  lineId: z.string().trim().min(1),
  basicRupees: rupeesToPaiseSchema,
  bonusRupees: rupeesToPaiseSchema,
  commissionRupees: rupeesToPaiseSchema.optional().default(0),
  advanceDeductedRupees: rupeesToPaiseSchema,
  adjustmentRupees: signedRupeesToPaiseSchema,
  adjustmentNote: z.string().trim().max(500).optional().or(z.literal("")),
});

export const markPayrollLinePaidSchema = z.object({
  lineId: z.string().trim().min(1),
  method: paymentMethodSchema,
  paidOn: dateOnlySchema.optional(),
});

export const unmarkPayrollLinePaidSchema = z.object({
  lineId: z.string().trim().min(1),
});

export const deletePayrollLineSchema = z.object({
  lineId: z.string().trim().min(1),
});

export const payrollRunIdSchema = z.object({
  runId: z.string().trim().min(1),
});

const yearMonthSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}$/, "invalidYearMonth");

export const generateMonthPayrollSchema = z.object({
  yearMonth: yearMonthSchema,
  lines: z
    .array(
      z.object({
        userId: z.string().trim().min(1),
        basicRupees: rupeesToPaiseSchema,
        bonusRupees: rupeesToPaiseSchema.optional(),
        advanceDeductedRupees: rupeesToPaiseSchema.optional(),
        adjustmentRupees: signedRupeesToPaiseSchema.optional(),
        adjustmentNote: z
          .string()
          .trim()
          .max(500)
          .optional()
          .or(z.literal("")),
      }),
    )
    .min(1)
    .max(200),
});

export const payrollManagementQuerySchema = z.object({
  yearMonth: z.union([yearMonthSchema, z.literal("all")]).default("all"),
  memberId: z.string().trim().min(1).optional().or(z.literal("")),
  status: z.enum(["ALL", "DRAFT", "PAID"]).optional().default("ALL"),
});

export const payrollMoneyListQuerySchema = z.object({
  yearMonth: yearMonthSchema,
  memberId: z.string().trim().min(1).optional().or(z.literal("")),
});

export type UpsertPayProfileInput = z.input<typeof upsertPayProfileSchema>;
export type GiveAdvanceInput = z.input<typeof giveAdvanceSchema>;
export type UpdateAdvanceInput = z.input<typeof updateAdvanceSchema>;
export type DeleteAdvanceInput = z.input<typeof deleteAdvanceSchema>;
export type GiveBonusInput = z.input<typeof giveBonusSchema>;
export type UpdateBonusInput = z.input<typeof updateBonusSchema>;
export type DeleteBonusInput = z.input<typeof deleteBonusSchema>;
export type CreatePayrollRunInput = z.input<typeof createPayrollRunSchema>;
export type UpdatePayrollLineInput = z.input<typeof updatePayrollLineSchema>;
export type MarkPayrollLinePaidInput = z.input<typeof markPayrollLinePaidSchema>;
export type UnmarkPayrollLinePaidInput = z.input<
  typeof unmarkPayrollLinePaidSchema
>;
export type DeletePayrollLineInput = z.input<typeof deletePayrollLineSchema>;
export type GenerateMonthPayrollInput = z.input<typeof generateMonthPayrollSchema>;
export type PayrollManagementQueryInput = z.input<
  typeof payrollManagementQuerySchema
>;
export type PayrollMoneyListQueryInput = z.input<
  typeof payrollMoneyListQuerySchema
>;

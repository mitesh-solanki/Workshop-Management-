import { z } from "zod";
import { GST_STATE_CODES } from "@/lib/gstin";
import { rupeesToPaiseSchema } from "@/lib/money";

export const INVOICE_STATUSES = ["DRAFT", "FINALIZED"] as const;
export type InvoiceStatusValue = (typeof INVOICE_STATUSES)[number];

export const INVOICE_LINE_TYPES = ["LABOUR", "PART"] as const;
export type InvoiceLineTypeValue = (typeof INVOICE_LINE_TYPES)[number];

export const GST_SPLIT_KINDS = ["CGST_SGST", "IGST"] as const;
export type GstSplitKindSchemaValue = (typeof GST_SPLIT_KINDS)[number];

export const PAYMENT_METHODS = ["CASH", "UPI", "CARD", "MIXED"] as const;
export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number];

export const CREDIT_NOTE_REASONS = ["CORRECTION", "REFUND", "OTHER"] as const;
export type CreditNoteReasonValue = (typeof CREDIT_NOTE_REASONS)[number];

export const PDF_LOCALES = ["en", "hi", "gu"] as const;
export type PdfLocale = (typeof PDF_LOCALES)[number];

const stateCodeField = z
  .string()
  .trim()
  .refine(
    (value): value is (typeof GST_STATE_CODES)[number] =>
      (GST_STATE_CODES as readonly string[]).includes(value),
    { message: "validation.invalidInput" },
  );

const optionalNotes = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value == null) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed.slice(0, 2000);
  });

const quantityField = z
  .union([z.string(), z.number()])
  .transform((value, ctx) => {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 99_999) {
      ctx.addIssue({ code: "custom", message: "validation.invalidQuantity" });
      return z.NEVER;
    }
    return n;
  });

const gstRateField = z
  .union([z.string(), z.number()])
  .transform((value, ctx) => {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(n) || n < 0 || n > 100) {
      ctx.addIssue({ code: "custom", message: "validation.invalidInput" });
      return z.NEVER;
    }
    return n;
  });

const hsnOrSacField = z
  .string()
  .trim()
  .min(2)
  .max(16)
  .regex(/^[0-9A-Za-z]+$/, "validation.invalidInput");

/** Create a draft (or finalize immediately) from approved estimate lines. */
export const createInvoiceFromEstimateSchema = z.object({
  /** Defaults to seller state (intra-state) when omitted. */
  placeOfSupplyStateCode: z
    .union([stateCodeField, z.literal(""), z.undefined()])
    .transform((value) => (value === "" || value == null ? undefined : value))
    .optional(),
  notes: optionalNotes.optional(),
  /** When true, allocate invoice number in the same transaction. */
  finalize: z
    .union([z.boolean(), z.string(), z.undefined()])
    .transform((value) => value === true || value === "true" || value === "on")
    .optional(),
});

export type CreateInvoiceFromEstimateInput = z.input<
  typeof createInvoiceFromEstimateSchema
>;

export const finalizeInvoiceSchema = z.object({
  invoiceId: z.string().trim().min(1),
});

export type FinalizeInvoiceInput = z.input<typeof finalizeInvoiceSchema>;

export const deleteDraftInvoiceSchema = z.object({
  invoiceId: z.string().trim().min(1),
});

export type DeleteDraftInvoiceInput = z.input<typeof deleteDraftInvoiceSchema>;

const paymentBreakdownSchema = z
  .object({
    method: z.enum(PAYMENT_METHODS),
    amountPaise: rupeesToPaiseSchema,
    cashPaise: rupeesToPaiseSchema.optional(),
    upiPaise: rupeesToPaiseSchema.optional(),
    cardPaise: rupeesToPaiseSchema.optional(),
    note: optionalNotes.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.amountPaise <= 0) {
      ctx.addIssue({
        code: "custom",
        message: "validation.invalidInput",
        path: ["amountPaise"],
      });
      return;
    }
    const cash = data.cashPaise ?? 0;
    const upi = data.upiPaise ?? 0;
    const card = data.cardPaise ?? 0;
    const breakdownSum = cash + upi + card;

    if (data.method === "MIXED") {
      if (breakdownSum !== data.amountPaise) {
        ctx.addIssue({
          code: "custom",
          message: "validation.invalidInput",
          path: ["amountPaise"],
        });
      }
      const parts = [cash > 0, upi > 0, card > 0].filter(Boolean).length;
      if (parts < 2) {
        ctx.addIssue({
          code: "custom",
          message: "validation.invalidInput",
          path: ["method"],
        });
      }
      return;
    }

    if (breakdownSum === 0) {
      return;
    }
    if (breakdownSum !== data.amountPaise) {
      ctx.addIssue({
        code: "custom",
        message: "validation.invalidInput",
        path: ["amountPaise"],
      });
    }
  });

export const recordPaymentSchema = paymentBreakdownSchema.extend({
  invoiceId: z.string().trim().min(1),
});

export type RecordPaymentInput = z.input<typeof recordPaymentSchema>;

/** Money returned to the customer after overpayment (credit note / overpay). */
export const recordRefundSchema = recordPaymentSchema;
export type RecordRefundInput = z.input<typeof recordRefundSchema>;

export const creditNoteLineSchema = z.object({
  description: z.string().trim().min(1).max(500),
  quantity: quantityField,
  unitPricePaise: rupeesToPaiseSchema,
  gstRatePercent: gstRateField,
  hsnOrSac: hsnOrSacField,
});

export const createCreditNoteSchema = z.object({
  invoiceId: z.string().trim().min(1),
  reason: z.enum(CREDIT_NOTE_REASONS),
  notes: optionalNotes.optional(),
  lines: z.array(creditNoteLineSchema).min(1).max(200),
});

export type CreateCreditNoteInput = z.input<typeof createCreditNoteSchema>;

export const invoicePdfLocaleSchema = z.enum(PDF_LOCALES);

export function normalizePaymentBreakdown(input: {
  method: PaymentMethodValue;
  amountPaise: number;
  cashPaise?: number | null;
  upiPaise?: number | null;
  cardPaise?: number | null;
}): { cashPaise: number; upiPaise: number; cardPaise: number } {
  const cash = input.cashPaise ?? 0;
  const upi = input.upiPaise ?? 0;
  const card = input.cardPaise ?? 0;
  if (cash + upi + card > 0) {
    return { cashPaise: cash, upiPaise: upi, cardPaise: card };
  }
  switch (input.method) {
    case "CASH":
      return { cashPaise: input.amountPaise, upiPaise: 0, cardPaise: 0 };
    case "UPI":
      return { cashPaise: 0, upiPaise: input.amountPaise, cardPaise: 0 };
    case "CARD":
      return { cashPaise: 0, upiPaise: 0, cardPaise: input.amountPaise };
    case "MIXED":
      return { cashPaise: cash, upiPaise: upi, cardPaise: card };
  }
}

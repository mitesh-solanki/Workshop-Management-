import { z } from "zod";
import { INVOICE_PAYMENT_STATUSES } from "@/modules/invoices/payment-status";

export const invoiceSearchSchema = z.object({
  q: z
    .string()
    .trim()
    .max(120, { error: "validation.tooLong" })
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  status: z
    .union([z.enum(INVOICE_PAYMENT_STATUSES), z.literal(""), z.undefined()])
    .transform((value) => (value === "" || value == null ? undefined : value)),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine((n) => [10, 20, 30, 40, 50].includes(n), {
      error: "validation.invalidInput",
    })
    .default(10),
});

export type InvoiceSearchInput = z.input<typeof invoiceSearchSchema>;
export type InvoiceSearchParsed = z.output<typeof invoiceSearchSchema>;

import { z } from "zod";

export const PAYMENT_PROVIDERS = ["NONE", "RAZORPAY"] as const;
export const PAYMENT_STATUSES = ["PENDING", "PAID", "FAILED"] as const;

export const startUpiPaymentSchema = z.object({
  invoiceId: z.string().trim().min(1),
  /** Optional override; defaults to full pending balance. */
  amountPaise: z.number().int().positive().optional(),
});

export type StartUpiPaymentInput = z.input<typeof startUpiPaymentSchema>;

export const razorpayWebhookPayloadSchema = z.object({
  event: z.string(),
  payload: z
    .object({
      payment_link: z
        .object({
          entity: z
            .object({
              id: z.string(),
              reference_id: z.string().optional(),
              status: z.string().optional(),
              amount_paid: z.number().int().optional(),
              notes: z.record(z.string(), z.string()).optional(),
            })
            .passthrough(),
        })
        .optional(),
      payment: z
        .object({
          entity: z
            .object({
              id: z.string(),
              amount: z.number().int().optional(),
              status: z.string().optional(),
              order_id: z.string().nullable().optional(),
              notes: z.record(z.string(), z.string()).optional(),
            })
            .passthrough(),
        })
        .optional(),
    })
    .passthrough(),
});

export type RazorpayWebhookPayload = z.infer<typeof razorpayWebhookPayloadSchema>;

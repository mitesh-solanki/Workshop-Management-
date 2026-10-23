/** Days after finalize before an unpaid bill shows as overdue (until due dates ship). */
export const INVOICE_OVERDUE_AFTER_DAYS = 7;

export const INVOICE_PAYMENT_STATUSES = [
  "DRAFT",
  "DUE",
  "OVERDUE",
  "PAID",
] as const;

export type InvoicePaymentStatus = (typeof INVOICE_PAYMENT_STATUSES)[number];

export function invoicePaymentStatus(input: {
  status: "DRAFT" | "FINALIZED";
  pendingBalancePaise: number;
  finalizedAt: Date | null;
  now?: Date;
}): InvoicePaymentStatus {
  if (input.status === "DRAFT") {
    return "DRAFT";
  }
  if (input.pendingBalancePaise <= 0) {
    return "PAID";
  }

  const now = input.now ?? new Date();
  const anchor = input.finalizedAt;
  if (anchor) {
    const overdueAfterMs =
      INVOICE_OVERDUE_AFTER_DAYS * 24 * 60 * 60 * 1000;
    if (now.getTime() - anchor.getTime() >= overdueAfterMs) {
      return "OVERDUE";
    }
  }
  return "DUE";
}

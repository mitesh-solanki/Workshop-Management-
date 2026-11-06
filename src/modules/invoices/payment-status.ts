/** Days after finalize before an unpaid bill shows as overdue (until due dates ship). */
export const INVOICE_OVERDUE_AFTER_DAYS = 7;

export const INVOICE_PAYMENT_STATUSES = [
  "DRAFT",
  "DUE",
  "PARTIAL",
  "OVERDUE",
  "PAID",
] as const;

export type InvoicePaymentStatus = (typeof INVOICE_PAYMENT_STATUSES)[number];

/** Payment due date = finalize date + overdue window. Null for drafts. */
export function invoiceDueDate(finalizedAt: Date | string | null): Date | null {
  if (finalizedAt == null) return null;
  const anchor =
    finalizedAt instanceof Date ? finalizedAt : new Date(finalizedAt);
  if (Number.isNaN(anchor.getTime())) return null;
  return new Date(
    anchor.getTime() + INVOICE_OVERDUE_AFTER_DAYS * 24 * 60 * 60 * 1000,
  );
}

export function invoicePaymentStatus(input: {
  status: "DRAFT" | "FINALIZED";
  pendingBalancePaise: number;
  amountPaidPaise: number;
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
  const dueAt = invoiceDueDate(input.finalizedAt);
  if (dueAt && now.getTime() >= dueAt.getTime()) {
    return "OVERDUE";
  }

  if (input.amountPaidPaise > 0) {
    return "PARTIAL";
  }

  return "DUE";
}

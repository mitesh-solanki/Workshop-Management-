import type { InvoicePaymentStatus } from "@/modules/invoices/payment-status";

export type InvoiceListItem = {
  id: string;
  serviceOrderId: string;
  status: "DRAFT" | "FINALIZED";
  paymentStatus: InvoicePaymentStatus;
  invoiceNumber: string | null;
  totalPaise: number;
  amountPaidPaise: number;
  pendingBalancePaise: number;
  finalizedAt: Date | null;
  createdAt: Date;
  customerName: string;
  customerPhone: string;
  vehicleRegistration: string | null;
  vehicleLabel: string | null;
};

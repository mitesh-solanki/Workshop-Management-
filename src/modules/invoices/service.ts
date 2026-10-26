import "server-only";

import { requireRole, type RoleSession } from "@/lib/rbac";
import {
  pendingBalancePaise,
  sumCreditNotesPaise,
} from "@/modules/billing/balance";
import { invoicePaymentStatus } from "@/modules/invoices/payment-status";
import { searchInvoices } from "@/modules/invoices/repo";
import { invoiceSearchSchema } from "@/modules/invoices/schema";

const READ_ROLES = ["OWNER", "MANAGER", "ACCOUNTANT"] as const;

export async function listInvoices(
  session: RoleSession,
  raw: {
    q?: string;
    status?: string;
    sort?: string;
    page?: number | string;
    pageSize?: number | string;
  } = {},
) {
  requireRole(session, READ_ROLES);
  const input = invoiceSearchSchema.parse(raw);

  const result = await searchInvoices(
    session.garageId,
    input.q,
    input.status,
    input.sort,
    input.page,
    input.pageSize,
  );

  return {
    ...result,
    items: result.items.map((invoice) => {
      const creditNotesTotalPaise = sumCreditNotesPaise(invoice.creditNotes);
      const pending = pendingBalancePaise({
        totalPaise: invoice.totalPaise,
        amountPaidPaise: invoice.amountPaidPaise,
        creditNotesTotalPaise,
      });
      return {
        id: invoice.id,
        serviceOrderId: invoice.serviceOrderId,
        status: invoice.status,
        paymentStatus: invoicePaymentStatus({
          status: invoice.status,
          pendingBalancePaise: pending,
          finalizedAt: invoice.finalizedAt,
        }),
        invoiceNumber: invoice.invoiceNumber,
        totalPaise: invoice.totalPaise,
        amountPaidPaise: invoice.amountPaidPaise,
        pendingBalancePaise: pending,
        finalizedAt: invoice.finalizedAt,
        createdAt: invoice.createdAt,
        customerName: invoice.customer.name,
        customerPhone: invoice.customer.phone,
        vehicleRegistration:
          invoice.serviceOrder.vehicle?.registrationNumber ?? null,
        vehicleLabel: invoice.serviceOrder.vehicle
          ? [invoice.serviceOrder.vehicle.make, invoice.serviceOrder.vehicle.model]
              .filter(Boolean)
              .join(" ")
          : null,
      };
    }),
  };
}

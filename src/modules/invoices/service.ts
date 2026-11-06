import "server-only";

import { AppError } from "@/lib/errors";
import { displayInvoiceNumber } from "@/lib/financial-year";
import { requireRole, type RoleSession } from "@/lib/rbac";
import {
  pendingBalancePaise,
  sumCreditNotesPaise,
} from "@/modules/billing/balance";
import {
  buildGstExportCsv,
  gstExportFilename,
  type GstExportInvoiceRow,
} from "@/modules/invoices/gst-export";
import { invoicePaymentStatus } from "@/modules/invoices/payment-status";
import {
  listFinalizedInvoicesForGstExport,
  listFinalizedInvoicesForGstExportByIds,
  searchInvoices,
  type GstExportInvoiceDbRow,
} from "@/modules/invoices/repo";
import {
  gstExportDownloadSchema,
  gstExportListSchema,
  invoiceSearchSchema,
} from "@/modules/invoices/schema";
import { periodFromYearMonth } from "@/modules/payroll/date";

const READ_ROLES = ["OWNER", "MANAGER", "ACCOUNTANT"] as const;

function monthRangeUtc(yearMonth: string): { from: Date; toExclusive: Date } {
  const { periodStart } = periodFromYearMonth(yearMonth);
  const y = periodStart.getUTCFullYear();
  const m = periodStart.getUTCMonth();
  return {
    from: periodStart,
    toExclusive: new Date(Date.UTC(y, m + 1, 1)),
  };
}

function toGstExportRow(invoice: GstExportInvoiceDbRow): GstExportInvoiceRow {
  const finalizedAt = invoice.finalizedAt ?? new Date(0);
  return {
    id: invoice.id,
    invoiceNumber:
      displayInvoiceNumber({
        invoiceNumber: invoice.invoiceNumber,
        jobCardNumber: invoice.serviceOrder.jobCardNumber,
        at: finalizedAt,
      }) ??
      invoice.invoiceNumber ??
      invoice.id,
    finalizedAt: finalizedAt.toISOString(),
    customerName: invoice.customer.name,
    customerGstin: invoice.customer.gstin,
    taxablePaise: invoice.taxablePaise,
    cgstPaise: invoice.cgstPaise,
    sgstPaise: invoice.sgstPaise,
    igstPaise: invoice.igstPaise,
    totalPaise: invoice.totalPaise,
  };
}

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
          amountPaidPaise: invoice.amountPaidPaise,
          finalizedAt: invoice.finalizedAt,
        }),
        invoiceNumber:
          displayInvoiceNumber({
            invoiceNumber: invoice.invoiceNumber,
            jobCardNumber: invoice.serviceOrder.jobCardNumber,
            at: invoice.finalizedAt ?? invoice.createdAt,
          }) ?? invoice.invoiceNumber,
        jobCardNumber: invoice.serviceOrder.jobCardNumber,
        totalPaise: invoice.totalPaise,
        amountPaidPaise: invoice.amountPaidPaise,
        creditNotesTotalPaise,
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

export async function listGstExportInvoices(
  session: RoleSession,
  raw: { yearMonth?: string },
) {
  requireRole(session, READ_ROLES);
  const input = gstExportListSchema.parse(raw);
  const { from, toExclusive } = monthRangeUtc(input.yearMonth);
  const rows = await listFinalizedInvoicesForGstExport(
    session.garageId,
    from,
    toExclusive,
  );
  return {
    yearMonth: input.yearMonth,
    items: rows.map(toGstExportRow),
  };
}

export async function buildGstExportFile(
  session: RoleSession,
  raw: { yearMonth?: string; invoiceIds?: string[] },
): Promise<{ filename: string; csv: string; count: number }> {
  requireRole(session, READ_ROLES);
  const input = gstExportDownloadSchema.parse(raw);
  const { from, toExclusive } = monthRangeUtc(input.yearMonth);
  const rows = await listFinalizedInvoicesForGstExportByIds(
    session.garageId,
    from,
    toExclusive,
    input.invoiceIds,
  );

  const byId = new Map(rows.map((row) => [row.id, row]));
  const ordered = input.invoiceIds
    .map((id) => byId.get(id))
    .filter((row): row is GstExportInvoiceDbRow => row != null)
    .map(toGstExportRow);

  if (ordered.length === 0) {
    throw new AppError("invoices.gst_export_none_selected", 400);
  }

  return {
    filename: gstExportFilename(input.yearMonth),
    csv: buildGstExportCsv(ordered),
    count: ordered.length,
  };
}

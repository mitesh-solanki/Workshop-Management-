import "server-only";

import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import {
  computeLineGstSplit,
  isSameStateSupply,
  sumLineGstSplit,
  type GstLineInput,
} from "@/lib/gst";
import { gstinStateCode, isKnownGstStateCode } from "@/lib/gstin";
import { requireRole, type RoleSession } from "@/lib/rbac";
import {
  pendingBalancePaise,
  refundDuePaise,
  sumCreditNotesPaise,
} from "@/modules/billing/balance";
import { generateInvoicePdf } from "@/modules/billing/pdf";
import type { PdfLocale } from "@/modules/billing/schema";
import {
  createCreditNoteSchema,
  createInvoiceFromEstimateSchema,
  deleteDraftInvoiceSchema,
  finalizeInvoiceSchema,
  normalizePaymentBreakdown,
  recordPaymentSchema,
  recordRefundSchema,
  type CreateCreditNoteInput,
  type CreateInvoiceFromEstimateInput,
  type DeleteDraftInvoiceInput,
  type FinalizeInvoiceInput,
  type InvoiceLineTypeValue,
  type RecordPaymentInput,
  type RecordRefundInput,
} from "@/modules/billing/schema";
import {
  createAndFinalizeInvoice,
  createCreditNoteRow,
  createDraftInvoice,
  deleteDraftInvoiceRow,
  finalizeInvoiceInTransaction,
  findGarageBillingProfile,
  findInvoiceById,
  listInvoicesForOrder,
  recordPaymentRow,
  recordRefundRow,
  type InvoiceLineCreateRow,
} from "@/modules/billing/repo";
import { findCurrentEstimate } from "@/modules/estimates/repo";
import { findServiceOrderById } from "@/modules/service-orders/repo";

const READ_ROLES = ["OWNER", "MANAGER", "TECHNICIAN", "ACCOUNTANT"] as const;
const WRITE_ROLES = ["OWNER", "MANAGER", "ACCOUNTANT"] as const;

function withBalance<
  T extends {
    totalPaise: number;
    amountPaidPaise: number;
    creditNotes: Array<{ totalPaise: number }>;
  },
>(invoice: T) {
  const creditNotesTotalPaise = sumCreditNotesPaise(invoice.creditNotes);
  const balanceInput = {
    totalPaise: invoice.totalPaise,
    amountPaidPaise: invoice.amountPaidPaise,
    creditNotesTotalPaise,
  };
  return {
    ...invoice,
    creditNotesTotalPaise,
    pendingBalancePaise: pendingBalancePaise(balanceInput),
    refundDuePaise: refundDuePaise(balanceInput),
  };
}

async function loadOrder(session: RoleSession, serviceOrderId: string) {
  const order = await findServiceOrderById(session.garageId, serviceOrderId);
  if (!order) {
    throw new NotFoundError();
  }
  if (
    session.role === "TECHNICIAN" &&
    order.technicianId !== session.userId
  ) {
    throw new ForbiddenError();
  }
  return order;
}

function resolveSellerStateCode(gstin: string | null | undefined): string {
  if (!gstin) {
    throw new AppError("billing.garage_gstin_required");
  }
  const code = gstinStateCode(gstin);
  if (!code) {
    throw new AppError("billing.garage_gstin_required");
  }
  return code;
}

function buildLinesFromApproved(
  lines: Array<{
    id: string;
    type: InvoiceLineTypeValue;
    description: string;
    quantity: number;
    unitPricePaise: number;
    gstRatePercent: number;
    hsnOrSac: string;
    approvalState: string;
  }>,
  sameState: boolean,
): InvoiceLineCreateRow[] {
  const approved = lines.filter((line) => line.approvalState === "APPROVED");
  return approved.map((line, index) => {
    const split = computeLineGstSplit(
      {
        quantity: line.quantity,
        unitPricePaise: line.unitPricePaise,
        gstRatePercent: line.gstRatePercent,
      },
      sameState,
    );
    return {
      estimateLineId: line.id,
      type: line.type,
      description: line.description,
      quantity: line.quantity,
      unitPricePaise: line.unitPricePaise,
      gstRatePercent: line.gstRatePercent,
      hsnOrSac: line.hsnOrSac,
      taxablePaise: split.taxablePaise,
      cgstPaise: split.cgstPaise,
      sgstPaise: split.sgstPaise,
      igstPaise: split.igstPaise,
      totalPaise: split.totalPaise,
      sortOrder: index,
    };
  });
}

export async function getInvoicesForOrder(
  session: RoleSession,
  serviceOrderId: string,
) {
  requireRole(session, READ_ROLES);
  await loadOrder(session, serviceOrderId);
  const invoices = await listInvoicesForOrder(session.garageId, serviceOrderId);
  return invoices.map(withBalance);
}

/** Garage name/address for invoice preview paper (same garage as session). */
export async function getGarageBillingProfile(session: RoleSession) {
  requireRole(session, READ_ROLES);
  return findGarageBillingProfile(session.garageId);
}

export async function getInvoice(
  session: RoleSession,
  invoiceId: string,
) {
  requireRole(session, READ_ROLES);
  const invoice = await findInvoiceById(session.garageId, invoiceId);
  if (!invoice) {
    throw new NotFoundError();
  }
  if (session.role === "TECHNICIAN") {
    await loadOrder(session, invoice.serviceOrderId);
  }
  return withBalance(invoice);
}

/**
 * Build an invoice from approved lines on the current estimate.
 * Optional finalize allocates the sequential FY number under a counter lock.
 */
export async function createInvoiceFromApprovedEstimate(
  session: RoleSession,
  serviceOrderId: string,
  raw: CreateInvoiceFromEstimateInput = {},
) {
  requireRole(session, WRITE_ROLES);
  const input = createInvoiceFromEstimateSchema.parse(raw);
  const order = await loadOrder(session, serviceOrderId);

  const estimate = await findCurrentEstimate(
    session.garageId,
    order.id,
  );
  if (!estimate) {
    throw new AppError("billing.estimate_missing");
  }
  if (estimate.supersededAt != null) {
    throw new AppError("billing.estimate_superseded");
  }

  const garage = await findGarageBillingProfile(session.garageId);
  if (!garage) {
    throw new NotFoundError();
  }
  const sellerStateCode = resolveSellerStateCode(garage.gstin);
  const vehicleStateCode = order.vehicle.stateCode;
  const placeOfSupplyStateCode =
    input.placeOfSupplyStateCode ??
    (isKnownGstStateCode(vehicleStateCode)
      ? vehicleStateCode
      : sellerStateCode);
  const sameState = isSameStateSupply(
    sellerStateCode,
    placeOfSupplyStateCode,
  );

  const existingInvoices = await listInvoicesForOrder(
    session.garageId,
    order.id,
  );
  const billedEstimateLineIds = new Set<string>();
  for (const invoice of existingInvoices) {
    for (const line of invoice.lines) {
      if (line.estimateLineId) {
        billedEstimateLineIds.add(line.estimateLineId);
      }
    }
  }

  const lineRows = buildLinesFromApproved(
    estimate.lines
      .filter((line) => !billedEstimateLineIds.has(line.id))
      .map((line) => ({
        id: line.id,
        type: line.type,
        description: line.description,
        quantity: line.quantity,
        unitPricePaise: line.unitPricePaise,
        gstRatePercent: line.gstRatePercent,
        hsnOrSac: line.hsnOrSac,
        approvalState: line.approvalState,
      })),
    sameState,
  );

  if (lineRows.length === 0) {
    throw new AppError(
      billedEstimateLineIds.size > 0
        ? "billing.no_unbilled_approved_lines"
        : "billing.no_approved_lines",
    );
  }

  const gstInputs: GstLineInput[] = lineRows.map((line) => ({
    quantity: line.quantity,
    unitPricePaise: line.unitPricePaise,
    gstRatePercent: line.gstRatePercent,
  }));
  const totals = sumLineGstSplit(gstInputs, sameState);

  const payload = {
    serviceOrderId: order.id,
    estimateId: estimate.id,
    customerId: order.customerId,
    sellerStateCode,
    placeOfSupplyStateCode,
    gstSplit: totals.kind,
    taxablePaise: totals.taxablePaise,
    cgstPaise: totals.cgstPaise,
    sgstPaise: totals.sgstPaise,
    igstPaise: totals.igstPaise,
    totalPaise: totals.totalPaise,
    notes: input.notes ?? null,
    createdById: session.userId,
    lines: lineRows,
  };

  const invoice = input.finalize
    ? await createAndFinalizeInvoice(session.garageId, payload)
    : await createDraftInvoice(session.garageId, payload);

  if (!invoice) {
    throw new AppError("billing.invoice_create_failed");
  }
  return withBalance(invoice);
}

export async function finalizeInvoice(
  session: RoleSession,
  raw: FinalizeInvoiceInput,
) {
  requireRole(session, WRITE_ROLES);
  const input = finalizeInvoiceSchema.parse(raw);

  try {
    await assertInvoiceEditable(session, input.invoiceId);
  } catch (error) {
    if (
      error instanceof AppError &&
      error.code === "billing.invoice_immutable"
    ) {
      throw new AppError("billing.invoice_already_finalized");
    }
    throw error;
  }

  // A draft is a snapshot. If the estimate changed while it was open,
  // require the user to remake the draft before it can be finalized.
  const draft = await findInvoiceById(session.garageId, input.invoiceId);
  if (!draft) {
    throw new NotFoundError();
  }
  const estimate = await findCurrentEstimate(session.garageId, draft.serviceOrderId);
  const issuedInvoices = await listInvoicesForOrder(
    session.garageId,
    draft.serviceOrderId,
  );
  const alreadyIssued = new Set(
    issuedInvoices
      .filter((invoice) => invoice.status === "FINALIZED")
      .flatMap((invoice) => invoice.lines.map((line) => line.estimateLineId))
      .filter((id): id is string => id !== null),
  );
  const expected = (estimate?.lines ?? []).filter(
    (line) => line.approvalState === "APPROVED" && !alreadyIssued.has(line.id),
  );
  const sameLines =
    estimate?.id === draft.estimateId &&
    draft.lines.length === expected.length &&
    expected.every((line) => {
      const snapshot = draft.lines.find((item) => item.estimateLineId === line.id);
      return (
        snapshot != null &&
        snapshot.description === line.description &&
        snapshot.type === line.type &&
        snapshot.quantity === line.quantity &&
        snapshot.unitPricePaise === line.unitPricePaise &&
        snapshot.gstRatePercent === line.gstRatePercent &&
        snapshot.hsnOrSac === line.hsnOrSac
      );
    });
  if (!sameLines) {
    throw new AppError("billing.invoice_draft_outdated");
  }

  const result = await finalizeInvoiceInTransaction(
    session.garageId,
    input.invoiceId,
    session.userId,
  );

  if (!result) {
    throw new NotFoundError();
  }
  if ("conflict" in result) {
    throw new AppError("billing.invoice_already_finalized");
  }
  if (!result.invoice) {
    throw new AppError("billing.invoice_finalize_failed");
  }
  return withBalance(result.invoice);
}

export async function deleteDraftInvoice(
  session: RoleSession,
  raw: DeleteDraftInvoiceInput,
) {
  requireRole(session, WRITE_ROLES);
  const input = deleteDraftInvoiceSchema.parse(raw);

  const invoice = await findInvoiceById(session.garageId, input.invoiceId);
  if (!invoice) {
    throw new NotFoundError();
  }
  await loadOrder(session, invoice.serviceOrderId);

  if (invoice.status !== "DRAFT") {
    throw new AppError("billing.invoice_immutable");
  }

  const deleted = await deleteDraftInvoiceRow(
    session.garageId,
    input.invoiceId,
    session.userId,
  );
  if (!deleted) {
    throw new AppError("billing.invoice_immutable");
  }
  return deleted;
}

/** Finalized invoices cannot be edited — call sites should use this guard. */
export async function assertInvoiceEditable(
  session: RoleSession,
  invoiceId: string,
) {
  const invoice = await findInvoiceById(session.garageId, invoiceId);
  if (!invoice) {
    throw new NotFoundError();
  }
  if (invoice.status === "FINALIZED") {
    throw new AppError("billing.invoice_immutable");
  }
  return invoice;
}

export async function recordInvoicePayment(
  session: RoleSession,
  raw: RecordPaymentInput,
) {
  requireRole(session, WRITE_ROLES);
  const input = recordPaymentSchema.parse(raw);
  const breakdown = normalizePaymentBreakdown({
    method: input.method,
    amountPaise: input.amountPaise,
    cashPaise: input.cashPaise,
    upiPaise: input.upiPaise,
    cardPaise: input.cardPaise,
  });

  const result = await recordPaymentRow(session.garageId, {
    invoiceId: input.invoiceId,
    method: input.method,
    amountPaise: input.amountPaise,
    cashPaise: breakdown.cashPaise,
    upiPaise: breakdown.upiPaise,
    cardPaise: breakdown.cardPaise,
    note: input.note ?? null,
    actorId: session.userId,
  });

  if (!result) {
    throw new NotFoundError();
  }
  if ("error" in result) {
    if (result.error === "not_finalized") {
      throw new AppError("billing.payment_requires_finalized");
    }
    throw new AppError("billing.payment_exceeds_balance", 400, {
      pending: String(result.pending ?? 0),
    });
  }
  if (!result.invoice) {
    throw new AppError("billing.payment_failed");
  }
  return {
    payment: result.payment,
    invoice: withBalance(result.invoice),
  };
}

export async function recordInvoiceRefund(
  session: RoleSession,
  raw: RecordRefundInput,
) {
  requireRole(session, WRITE_ROLES);
  const input = recordRefundSchema.parse(raw);
  const breakdown = normalizePaymentBreakdown({
    method: input.method,
    amountPaise: input.amountPaise,
    cashPaise: input.cashPaise,
    upiPaise: input.upiPaise,
    cardPaise: input.cardPaise,
  });

  const result = await recordRefundRow(session.garageId, {
    invoiceId: input.invoiceId,
    method: input.method,
    amountPaise: input.amountPaise,
    cashPaise: breakdown.cashPaise,
    upiPaise: breakdown.upiPaise,
    cardPaise: breakdown.cardPaise,
    note: input.note ?? null,
    actorId: session.userId,
  });

  if (!result) {
    throw new NotFoundError();
  }
  if ("error" in result) {
    if (result.error === "not_finalized") {
      throw new AppError("billing.payment_requires_finalized");
    }
    throw new AppError("billing.refund_exceeds_due", 400, {
      refundDue: String(result.refundDue ?? 0),
    });
  }
  if (!result.invoice) {
    throw new AppError("billing.refund_failed");
  }
  return {
    payment: result.payment,
    invoice: withBalance(result.invoice),
  };
}

export async function createCreditNote(
  session: RoleSession,
  raw: CreateCreditNoteInput,
) {
  requireRole(session, WRITE_ROLES);
  const input = createCreditNoteSchema.parse(raw);

  const invoice = await findInvoiceById(session.garageId, input.invoiceId);
  if (!invoice) {
    throw new NotFoundError();
  }
  if (invoice.status !== "FINALIZED") {
    throw new AppError("billing.credit_note_requires_finalized");
  }

  const sameState = invoice.gstSplit === "CGST_SGST";
  const lineRows = input.lines.map((line, index) => {
    const split = computeLineGstSplit(
      {
        quantity: line.quantity,
        unitPricePaise: line.unitPricePaise,
        gstRatePercent: line.gstRatePercent,
      },
      sameState,
    );
    return {
      description: line.description,
      quantity: line.quantity,
      unitPricePaise: line.unitPricePaise,
      gstRatePercent: line.gstRatePercent,
      hsnOrSac: line.hsnOrSac,
      taxablePaise: split.taxablePaise,
      cgstPaise: split.cgstPaise,
      sgstPaise: split.sgstPaise,
      igstPaise: split.igstPaise,
      totalPaise: split.totalPaise,
      sortOrder: index,
    };
  });

  const totals = sumLineGstSplit(
    lineRows.map((line) => ({
      quantity: line.quantity,
      unitPricePaise: line.unitPricePaise,
      gstRatePercent: line.gstRatePercent,
    })),
    sameState,
  );

  const result = await createCreditNoteRow(session.garageId, {
    invoiceId: input.invoiceId,
    reason: input.reason,
    notes: input.notes ?? null,
    actorId: session.userId,
    taxablePaise: totals.taxablePaise,
    cgstPaise: totals.cgstPaise,
    sgstPaise: totals.sgstPaise,
    igstPaise: totals.igstPaise,
    totalPaise: totals.totalPaise,
    lines: lineRows,
  });

  if (!result) {
    throw new NotFoundError();
  }
  if ("error" in result) {
    if (result.error === "not_finalized") {
      throw new AppError("billing.credit_note_requires_finalized");
    }
    throw new AppError("billing.credit_note_exceeds_invoice");
  }
  if (!result.invoice) {
    throw new AppError("billing.credit_note_failed");
  }
  return {
    creditNote: result.creditNote,
    invoice: withBalance(result.invoice),
  };
}

export async function getInvoicePdfBuffer(
  session: RoleSession,
  invoiceId: string,
  locale: PdfLocale,
) {
  requireRole(session, READ_ROLES);
  const invoice = await findInvoiceById(session.garageId, invoiceId);
  if (!invoice) {
    throw new NotFoundError();
  }
  if (session.role === "TECHNICIAN") {
    await loadOrder(session, invoice.serviceOrderId);
  }

  const garage = await findGarageBillingProfile(session.garageId);
  if (!garage) {
    throw new NotFoundError();
  }

  return generateInvoicePdf({
    locale,
    status: invoice.status,
    invoiceNumber: invoice.invoiceNumber,
    issuedAt: invoice.finalizedAt ?? invoice.createdAt,
    garage: {
      name: garage.name,
      address: garage.address,
      gstin: garage.gstin,
    },
    customer: {
      name: invoice.customer.name,
      phone: invoice.customer.phone,
      address: invoice.customer.address,
    },
    vehicle: invoice.serviceOrder.vehicle,
    placeOfSupplyStateCode: invoice.placeOfSupplyStateCode,
    sellerStateCode: invoice.sellerStateCode,
    gstSplit: invoice.gstSplit,
    lines: invoice.lines.map((line) => ({
      description: line.description,
      hsnOrSac: line.hsnOrSac,
      quantity: line.quantity,
      unitPricePaise: line.unitPricePaise,
      gstRatePercent: line.gstRatePercent,
      taxablePaise: line.taxablePaise,
      cgstPaise: line.cgstPaise,
      sgstPaise: line.sgstPaise,
      igstPaise: line.igstPaise,
      totalPaise: line.totalPaise,
    })),
    taxablePaise: invoice.taxablePaise,
    cgstPaise: invoice.cgstPaise,
    sgstPaise: invoice.sgstPaise,
    igstPaise: invoice.igstPaise,
    totalPaise: invoice.totalPaise,
    amountPaidPaise: invoice.amountPaidPaise,
    payments: invoice.payments.map((payment) => ({
      method: payment.method,
      amountPaise: payment.amountPaise,
      receivedAt: payment.receivedAt,
    })),
    creditNotes: invoice.creditNotes.map((note) => ({
      reason: note.reason as "CORRECTION" | "REFUND" | "OTHER",
      notes: note.notes,
      itemDescriptions: note.lines.map((line) => line.description),
      totalPaise: note.totalPaise,
    })),
    notes: invoice.notes,
  });
}

/** Test helper: refuse cross-garage invoice read. */
export async function getInvoiceForGarageId(
  session: RoleSession,
  requestedGarageId: string,
  invoiceId: string,
) {
  if (requestedGarageId !== session.garageId) {
    throw new ForbiddenError();
  }
  return getInvoice(session, invoiceId);
}

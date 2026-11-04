import "server-only";

import { calendarDayBoundsUtc } from "@/lib/calendar-day";
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
  deleteInvoiceSchema,
  finalizeInvoiceSchema,
  normalizePaymentBreakdown,
  recordPaymentSchema,
  recordRefundSchema,
  syncInvoiceFromJobCardSchema,
  updateInvoiceLinesSchema,
  type CreateCreditNoteInput,
  type CreateInvoiceFromEstimateInput,
  type DeleteInvoiceInput,
  type FinalizeInvoiceInput,
  type InvoiceLineTypeValue,
  defaultInvoiceHsnOrSac,
  isBillableOrderLineType,
  resolveInvoiceEditLineTax,
  deletePaymentSchema,
  type DeletePaymentInput,
  type RecordPaymentInput,
  type RecordRefundInput,
  type SyncInvoiceFromJobCardInput,
  type UpdateInvoiceLinesInput,
  updatePaymentSchema,
  type UpdatePaymentInput,
} from "@/modules/billing/schema";
import {
  createAndFinalizeInvoice,
  createCreditNoteRow,
  createDraftInvoice,
  deleteInvoiceRow,
  sumPaymentsReceivedInWindow,
  deletePaymentRow,
  finalizeInvoiceInTransaction,
  findGarageBillingProfile,
  findInvoiceById,
  listInvoicesForOrder,
  recordPaymentRow,
  recordRefundRow,
  replaceInvoiceLinesRow,
  updatePaymentRow,
  type InvoiceLineCreateRow,
} from "@/modules/billing/repo";
import { findPartById } from "@/modules/inventory/repo";
import {
  createServiceOrderLine,
  findServiceOrderById,
  updateServiceOrderLine,
} from "@/modules/service-orders/repo";
import { partRequiresWarrantyCard } from "@/modules/warranties/part-requires-warranty";
import {
  listWarrantiesForInvoice,
  relinkWarrantyToInvoiceLine,
} from "@/modules/warranties/repo";
import { assertBatteryWarrantiesCompleteForInvoice } from "@/modules/warranties/service";

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

function buildLinesFromOrderSnapshots(
  lines: Array<{
    estimateLineId: string | null;
    type: InvoiceLineTypeValue;
    description: string;
    quantity: number;
    unitPricePaise: number;
    gstRatePercent: number;
    hsnOrSac: string;
  }>,
  sameState: boolean,
): InvoiceLineCreateRow[] {
  return lines.map((line, index) => {
    const split = computeLineGstSplit(
      {
        quantity: line.quantity,
        unitPricePaise: line.unitPricePaise,
        gstRatePercent: line.gstRatePercent,
      },
      sameState,
    );
    return {
      estimateLineId: line.estimateLineId,
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

/** Home KPI — net customer payments received on the workshop calendar day. */
export async function getDashboardPaymentsReceivedToday(session: RoleSession) {
  requireRole(session, ["OWNER", "MANAGER", "ACCOUNTANT"]);
  const day = calendarDayBoundsUtc();
  return sumPaymentsReceivedInWindow(session.garageId, day);
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

function pricedOrderLineIdSet(
  lines: Array<{ id: string; type: string; unitPricePaise: number; quantity: number }>,
) {
  return new Set(
    lines
      .filter(
        (line) =>
          isBillableOrderLineType(line.type) &&
          line.unitPricePaise > 0 &&
          line.quantity > 0,
      )
      .map((line) => line.id),
  );
}

function draftMatchesExpectedOrderLines(
  draft: {
    lines: Array<{
      description: string;
      type: string;
      quantity: number;
      unitPricePaise: number;
      gstRatePercent: number;
      hsnOrSac: string;
    }>;
  },
  expected: Array<{
    description: string;
    type: string;
    quantity: number;
    unitPricePaise: number;
    gstRatePercent: number;
    hsnOrSac: string;
  }>,
) {
  if (draft.lines.length !== expected.length) {
    return false;
  }
  return expected.every((line) => {
    const snapshot = draft.lines.find(
      (item) =>
        item.description === line.description &&
        item.type === line.type &&
        item.quantity === line.quantity &&
        item.unitPricePaise === line.unitPricePaise &&
        item.gstRatePercent === line.gstRatePercent &&
        item.hsnOrSac === line.hsnOrSac,
    );
    return snapshot != null;
  });
}

function defaultHsnOrSacForType(type: string) {
  return defaultInvoiceHsnOrSac(type);
}

function billableOrderLineSnapshots(order: {
  lines: Array<{
    id: string;
    type: string;
    description: string;
    quantity: number;
    unitPricePaise: number;
    part?: { gstRatePercent?: number | null; hsn?: string | null } | null;
  }>;
}) {
  return order.lines
    .filter(
      (line) =>
        isBillableOrderLineType(line.type) &&
        line.unitPricePaise > 0 &&
        line.quantity > 0,
    )
    .map((line) => {
      const part = line.part ?? null;
      return {
        estimateLineId: null as string | null,
        type: line.type as InvoiceLineTypeValue,
        description: line.description,
        quantity: line.quantity,
        unitPricePaise: line.unitPricePaise,
        gstRatePercent:
          part && typeof part.gstRatePercent === "number"
            ? part.gstRatePercent
            : 18,
        hsnOrSac:
          part && typeof part.hsn === "string" && part.hsn.trim()
            ? part.hsn.trim()
            : defaultHsnOrSacForType(line.type),
      };
    });
}

/**
 * One bill per job: return the existing bill if any.
 * Does not auto-create after delete — empty billing shows Create Draft explicitly.
 */
export async function ensureDraftInvoiceInSync(
  session: RoleSession,
  serviceOrderId: string,
) {
  requireRole(session, WRITE_ROLES);
  const order = await loadOrder(session, serviceOrderId);
  const invoices = await listInvoicesForOrder(session.garageId, order.id);
  if (invoices.length === 0) {
    return null;
  }
  const draft = invoices.find((invoice) => invoice.status === "DRAFT");
  return withBalance(draft ?? invoices[0]!);
}

/**
 * Build an invoice from priced labour / parts / outside work on the job card.
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

  // Bill only from priced job-card lines. Estimate is separate (inspection).
  const garage = await findGarageBillingProfile(session.garageId);
  if (!garage) {
    throw new NotFoundError();
  }
  const sellerStateCode = resolveSellerStateCode(garage.gstin);
  const customerStateCode = order.customer.stateCode;
  const placeOfSupplyStateCode =
    input.placeOfSupplyStateCode ??
    (isKnownGstStateCode(customerStateCode)
      ? customerStateCode
      : sellerStateCode);
  const sameState = isSameStateSupply(
    sellerStateCode,
    placeOfSupplyStateCode,
  );

  const existingInvoices = await listInvoicesForOrder(
    session.garageId,
    order.id,
  );
  if (existingInvoices.length > 0) {
    throw new AppError("billing.invoice_already_exists");
  }

  const snapshots = billableOrderLineSnapshots(order);
  const lineRows = buildLinesFromOrderSnapshots(snapshots, sameState);

  if (lineRows.length === 0) {
    throw new AppError("billing.no_priced_lines");
  }

  const gstInputs: GstLineInput[] = lineRows.map((line) => ({
    quantity: line.quantity,
    unitPricePaise: line.unitPricePaise,
    gstRatePercent: line.gstRatePercent,
  }));
  const totals = sumLineGstSplit(gstInputs, sameState);

  const payload = {
    serviceOrderId: order.id,
    estimateId: null,
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

  const needsBatteryWarranty = lineRows.some(
    (line) =>
      line.type === "PART" && partRequiresWarrantyCard(line.description),
  );
  if (input.finalize && needsBatteryWarranty) {
    throw new AppError("warranties.finalize_requires_draft_first", 400);
  }

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

  // Draft must match current job-card labour / parts / outside work.
  const draft = await findInvoiceById(session.garageId, input.invoiceId);
  if (!draft) {
    throw new NotFoundError();
  }
  const order = await loadOrder(session, draft.serviceOrderId);
  const expected = billableOrderLineSnapshots(order);
  if (!draftMatchesExpectedOrderLines(draft, expected)) {
    throw new AppError("billing.invoice_draft_outdated");
  }

  await assertBatteryWarrantiesCompleteForInvoice(
    session.garageId,
    input.invoiceId,
  );

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
  raw: DeleteInvoiceInput,
) {
  return deleteInvoice(session, raw);
}

/** Delete the job's bill, including any payments and credit notes on it. */
export async function deleteInvoice(
  session: RoleSession,
  raw: DeleteInvoiceInput,
) {
  requireRole(session, WRITE_ROLES);
  const input = deleteInvoiceSchema.parse(raw);

  const invoice = await findInvoiceById(session.garageId, input.invoiceId);
  if (!invoice) {
    throw new NotFoundError();
  }
  await loadOrder(session, invoice.serviceOrderId);

  const deleted = await deleteInvoiceRow(
    session.garageId,
    input.invoiceId,
    session.userId,
  );
  if (!deleted) {
    throw new NotFoundError();
  }
  return deleted;
}

/**
 * Rebuild the draft from current job-card labour / parts / outside work, keeping warranty cards
 * that still match a part on the new draft (by estimate line, then part name).
 */
export async function remakeDraftInvoice(
  session: RoleSession,
  serviceOrderId: string,
  invoiceId: string,
  raw: CreateInvoiceFromEstimateInput = {},
) {
  requireRole(session, WRITE_ROLES);

  const draft = await findInvoiceById(session.garageId, invoiceId);
  if (!draft) {
    throw new NotFoundError();
  }
  if (draft.serviceOrderId !== serviceOrderId) {
    throw new NotFoundError();
  }
  if (draft.status !== "DRAFT") {
    throw new AppError("billing.invoice_immutable");
  }

  const warranties = await listWarrantiesForInvoice(
    session.garageId,
    invoiceId,
  );
  const byEstimateLineId = new Map<string, string>();
  const byPartName = new Map<string, string>();
  for (const line of draft.lines) {
    if (line.type !== "PART") continue;
    const doc = warranties.find((item) => item.invoiceLineId === line.id);
    if (!doc) continue;
    if (line.estimateLineId) {
      byEstimateLineId.set(line.estimateLineId, doc.id);
    }
    byPartName.set(line.description.trim().toLowerCase(), doc.id);
  }

  await deleteDraftInvoice(session, { invoiceId });
  const created = await createInvoiceFromApprovedEstimate(
    session,
    serviceOrderId,
    { ...raw, finalize: false },
  );

  const fresh = await findInvoiceById(session.garageId, created.id);
  if (!fresh) {
    return created;
  }

  const usedWarrantyIds = new Set<string>();
  for (const line of fresh.lines) {
    if (line.type !== "PART") continue;
    const warrantyId =
      (line.estimateLineId
        ? byEstimateLineId.get(line.estimateLineId)
        : undefined) ?? byPartName.get(line.description.trim().toLowerCase());
    if (!warrantyId || usedWarrantyIds.has(warrantyId)) continue;
    usedWarrantyIds.add(warrantyId);
    await relinkWarrantyToInvoiceLine({
      garageId: session.garageId,
      warrantyId,
      invoiceId: fresh.id,
      invoiceLineId: line.id,
      actorId: session.userId,
    });
  }

  return withBalance(fresh);
}

/**
 * Finalized invoices cannot be finalized again / remade as draft.
 * Line edits use updateInvoiceLines / syncInvoiceFromJobCard instead.
 */
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

function lineFingerprint(line: {
  description: string;
  type: string;
  quantity: number;
  unitPricePaise: number;
}) {
  return `${line.description}|${line.type}|${line.quantity}|${line.unitPricePaise}`;
}

async function syncJobCardFromInvoiceLines(
  session: RoleSession,
  serviceOrderId: string,
  previous: Array<{
    description: string;
    type: string;
    quantity: number;
    unitPricePaise: number;
  }>,
  next: Array<{
    description: string;
    type: InvoiceLineTypeValue;
    quantity: number;
    unitPricePaise: number;
    partId?: string | null;
  }>,
) {
  const order = await loadOrder(session, serviceOrderId);
  const pool = order.lines
    .filter((line) => isBillableOrderLineType(line.type))
    .map((line) => ({
      id: line.id,
      type: line.type,
      description: line.description,
      quantity: line.quantity,
      unitPricePaise: line.unitPricePaise,
      partId: line.partId ?? null,
      claimed: false,
    }));

  const matchedIds: Array<string | null> = previous.map((prev) => {
    const fp = lineFingerprint(prev);
    const hit = pool.find(
      (line) => !line.claimed && lineFingerprint(line) === fp,
    );
    if (!hit) return null;
    hit.claimed = true;
    return hit.id;
  });

  for (let index = 0; index < next.length; index += 1) {
    const line = next[index]!;
    const matchedId = matchedIds[index] ?? null;
    const nextPartId =
      line.type === "PART" ? (line.partId ?? null) : null;
    if (matchedId) {
      const existing = pool.find((row) => row.id === matchedId);
      const updated = await updateServiceOrderLine(session.garageId, {
        lineId: matchedId,
        serviceOrderId,
        description: line.description,
        quantity: line.type === "PART" ? line.quantity : 1,
        unitPricePaise: line.unitPricePaise,
        ...(line.type === "PART"
          ? { partId: nextPartId ?? existing?.partId ?? null }
          : {}),
        actorId: session.userId,
      });
      if (!updated.ok) {
        if (updated.reason === "INSUFFICIENT_STOCK") {
          throw new AppError("inventory.insufficient_stock", 409, {
            partName: updated.partName ?? "",
          });
        }
        throw new NotFoundError();
      }
      continue;
    }

    const created = await createServiceOrderLine(session.garageId, {
      serviceOrderId,
      type: line.type,
      description: line.description,
      quantity: line.type === "PART" ? line.quantity : 1,
      unitPricePaise: line.unitPricePaise,
      partId: nextPartId,
      actorId: session.userId,
    });
    if (!created.ok) {
      if (created.reason === "INSUFFICIENT_STOCK") {
        throw new AppError("inventory.insufficient_stock", 409, {
          partName: created.partName ?? "",
        });
      }
      throw new NotFoundError();
    }
  }
}

async function replaceInvoiceLinesFromSnapshots(
  session: RoleSession,
  invoice: {
    id: string;
    serviceOrderId: string;
    sellerStateCode: string;
    placeOfSupplyStateCode: string;
    notes: string | null;
    lines: Array<{
      id: string;
      type: string;
      description: string;
      estimateLineId: string | null;
    }>;
  },
  snapshots: Array<{
    estimateLineId: string | null;
    type: InvoiceLineTypeValue;
    description: string;
    quantity: number;
    unitPricePaise: number;
    gstRatePercent: number;
    hsnOrSac: string;
  }>,
  notes?: string | null,
) {
  const sameState = isSameStateSupply(
    invoice.sellerStateCode,
    invoice.placeOfSupplyStateCode,
  );
  const lineRows = buildLinesFromOrderSnapshots(snapshots, sameState);
  if (lineRows.length === 0) {
    throw new AppError("billing.no_priced_lines");
  }

  const warranties = await listWarrantiesForInvoice(
    session.garageId,
    invoice.id,
  );
  const byEstimateLineId = new Map<string, string>();
  const byPartName = new Map<string, string>();
  for (const line of invoice.lines) {
    if (line.type !== "PART") continue;
    const doc = warranties.find((item) => item.invoiceLineId === line.id);
    if (!doc) continue;
    if (line.estimateLineId) {
      byEstimateLineId.set(line.estimateLineId, doc.id);
    }
    byPartName.set(line.description.trim().toLowerCase(), doc.id);
  }

  const gstInputs: GstLineInput[] = lineRows.map((line) => ({
    quantity: line.quantity,
    unitPricePaise: line.unitPricePaise,
    gstRatePercent: line.gstRatePercent,
  }));
  const totals = sumLineGstSplit(gstInputs, sameState);

  const replaced = await replaceInvoiceLinesRow(session.garageId, {
    invoiceId: invoice.id,
    actorId: session.userId,
    taxablePaise: totals.taxablePaise,
    cgstPaise: totals.cgstPaise,
    sgstPaise: totals.sgstPaise,
    igstPaise: totals.igstPaise,
    totalPaise: totals.totalPaise,
    gstSplit: totals.kind,
    notes: notes === undefined ? undefined : notes,
    lines: lineRows,
  });
  if (!replaced) {
    throw new NotFoundError();
  }

  const usedWarrantyIds = new Set<string>();
  for (const line of replaced.lines) {
    if (line.type !== "PART") continue;
    const warrantyId =
      (line.estimateLineId
        ? byEstimateLineId.get(line.estimateLineId)
        : undefined) ?? byPartName.get(line.description.trim().toLowerCase());
    if (!warrantyId || usedWarrantyIds.has(warrantyId)) continue;
    usedWarrantyIds.add(warrantyId);
    await relinkWarrantyToInvoiceLine({
      garageId: session.garageId,
      warrantyId,
      invoiceId: replaced.id,
      invoiceLineId: line.id,
      actorId: session.userId,
    });
  }

  return withBalance(replaced);
}

/** Edit bill lines (draft or finalized) and push changes onto the job card. */
export async function updateInvoiceLines(
  session: RoleSession,
  raw: UpdateInvoiceLinesInput,
) {
  requireRole(session, WRITE_ROLES);
  const input = updateInvoiceLinesSchema.parse(raw);
  const invoice = await findInvoiceById(session.garageId, input.invoiceId);
  if (!invoice) {
    throw new NotFoundError();
  }
  const order = await loadOrder(session, invoice.serviceOrderId);

  const previous = invoice.lines.map((line) => ({
    description: line.description,
    type: line.type,
    quantity: line.quantity,
    unitPricePaise: line.unitPricePaise,
  }));

  const existingById = new Map(
    invoice.lines.map((line) => [line.id, line] as const),
  );
  const orderPool = order.lines
    .filter((line) => isBillableOrderLineType(line.type))
    .map((line) => ({ ...line, claimed: false }));

  const partIds = [
    ...new Set(
      input.lines
        .map((line) => line.partId)
        .filter((partId): partId is string => Boolean(partId)),
    ),
  ];
  const partsById = new Map<
    string,
    NonNullable<Awaited<ReturnType<typeof findPartById>>>
  >();
  await Promise.all(
    partIds.map(async (partId) => {
      const part = await findPartById(session.garageId, partId);
      if (part) {
        partsById.set(partId, part);
      }
    }),
  );

  const snapshots = input.lines.map((line) => {
    const existing = line.id ? existingById.get(line.id) : undefined;
    const quantity = line.type === "PART" ? line.quantity : 1;
    const selectedPart = line.partId ? partsById.get(line.partId) : undefined;
    const orderLine =
      orderPool.find(
        (row) =>
          !row.claimed &&
          row.type === line.type &&
          row.description === line.description,
      ) ??
      (existing
        ? orderPool.find(
            (row) =>
              !row.claimed &&
              row.type === existing.type &&
              row.description === existing.description,
          )
        : undefined);
    if (orderLine) {
      orderLine.claimed = true;
    }

    const tax = resolveInvoiceEditLineTax({
      type: line.type,
      gstRatePercent: line.gstRatePercent,
      hsnOrSac: line.hsnOrSac,
      existing: existing
        ? {
            gstRatePercent: existing.gstRatePercent,
            hsnOrSac: existing.hsnOrSac,
          }
        : null,
      part: selectedPart ?? orderLine?.part ?? null,
    });

    return {
      estimateLineId: existing?.estimateLineId ?? null,
      type: line.type,
      description: line.description,
      quantity,
      unitPricePaise: line.unitPricePaise,
      gstRatePercent: tax.gstRatePercent,
      hsnOrSac: tax.hsnOrSac,
      partId: line.type === "PART" ? (line.partId ?? null) : null,
    };
  });

  const updated = await replaceInvoiceLinesFromSnapshots(
    session,
    invoice,
    snapshots.map(({ partId: _partId, ...line }) => line),
    input.notes === undefined ? undefined : input.notes,
  );

  await syncJobCardFromInvoiceLines(
    session,
    invoice.serviceOrderId,
    previous,
    snapshots.map((line) => ({
      description: line.description,
      type: line.type,
      quantity: line.quantity,
      unitPricePaise: line.unitPricePaise,
      partId: line.partId,
    })),
  );

  return updated;
}

/** Rebuild the job's single bill from current priced labour / parts / outside work. */
export async function syncInvoiceFromJobCard(
  session: RoleSession,
  raw: SyncInvoiceFromJobCardInput,
) {
  requireRole(session, WRITE_ROLES);
  const input = syncInvoiceFromJobCardSchema.parse(raw);
  const order = await loadOrder(session, input.serviceOrderId);
  const invoices = await listInvoicesForOrder(session.garageId, order.id);
  const target =
    invoices.find((invoice) => invoice.status === "DRAFT") ?? invoices[0];
  if (!target) {
    throw new AppError("billing.no_invoice");
  }

  const snapshots = billableOrderLineSnapshots(order);
  if (snapshots.length === 0) {
    throw new AppError("billing.no_priced_lines");
  }

  return replaceInvoiceLinesFromSnapshots(session, target, snapshots);
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

export async function updateInvoicePayment(
  session: RoleSession,
  raw: UpdatePaymentInput,
) {
  requireRole(session, WRITE_ROLES);
  const input = updatePaymentSchema.parse(raw);
  const breakdown = normalizePaymentBreakdown({
    method: input.method,
    amountPaise: input.amountPaise,
    cashPaise: input.cashPaise,
    upiPaise: input.upiPaise,
    cardPaise: input.cardPaise,
  });

  const result = await updatePaymentRow(session.garageId, {
    invoiceId: input.invoiceId,
    paymentId: input.paymentId,
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
    if (result.error === "online_locked") {
      throw new AppError("billing.payment_online_locked", 409);
    }
    if (result.error === "refund_locked") {
      throw new AppError("billing.payment_refund_locked", 409);
    }
    throw new AppError("billing.payment_exceeds_balance", 400, {
      pending: String(result.pending ?? 0),
    });
  }
  if (!result.invoice) {
    throw new AppError("billing.payment_failed");
  }
  return {
    paymentId: result.paymentId,
    invoice: withBalance(result.invoice),
  };
}

export async function deleteInvoicePayment(
  session: RoleSession,
  raw: DeletePaymentInput,
) {
  requireRole(session, WRITE_ROLES);
  const input = deletePaymentSchema.parse(raw);

  const result = await deletePaymentRow(session.garageId, {
    invoiceId: input.invoiceId,
    paymentId: input.paymentId,
    actorId: session.userId,
  });

  if (!result) {
    throw new NotFoundError();
  }
  if ("error" in result) {
    if (result.error === "not_finalized") {
      throw new AppError("billing.payment_requires_finalized");
    }
    if (result.error === "online_locked") {
      throw new AppError("billing.payment_online_locked", 409);
    }
    throw new AppError("billing.payment_failed");
  }
  if (!result.invoice) {
    throw new AppError("billing.payment_failed");
  }
  return {
    paymentId: result.paymentId,
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

  const warrantyDocs = await listWarrantiesForInvoice(
    session.garageId,
    invoice.id,
  );
  const warranties = warrantyDocs
    .flatMap((doc) => {
      if (!doc.warrantyExpiresAt) return [];
      const expiresAt =
        doc.warrantyExpiresAt instanceof Date
          ? doc.warrantyExpiresAt
          : new Date(doc.warrantyExpiresAt);
      if (!doc.partName.trim() || Number.isNaN(expiresAt.getTime())) {
        return [];
      }
      return [{ partName: doc.partName, expiresAt }];
    });

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
      gstin: invoice.customer.gstin,
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
    warranties,
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

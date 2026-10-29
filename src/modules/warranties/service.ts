import "server-only";

import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { requireRole, type RoleSession } from "@/lib/rbac";
import {
  buildVehicleWarrantyKey,
  createPresignedDownloadUrl,
  createPresignedUploadUrl,
  deleteStoredObject,
  storageKeyBelongsToGarage,
} from "@/lib/storage";
import { findInvoiceById } from "@/modules/billing/repo";
import { findServiceOrderById } from "@/modules/service-orders/repo";
import { findVehicleById } from "@/modules/vehicles/repo";
import {
  createManualWarrantySchema,
  deleteWarrantySchema,
  requestWarrantyUploadSchema,
  saveInvoiceLineWarrantySchema,
  type CreateManualWarrantyInput,
  type DeleteWarrantyInput,
  type RequestWarrantyUploadInput,
  type SaveInvoiceLineWarrantyInput,
} from "@/modules/warranties/schema";
import { partRequiresWarrantyCard } from "@/modules/warranties/part-requires-warranty";
import {
  createManualWarranty,
  deleteWarrantyById,
  findWarrantyById,
  findWarrantyByInvoiceLine,
  listWarrantiesForCustomer,
  listWarrantiesForInvoice,
  listWarrantiesForVehicle,
  upsertInvoiceLineWarranty,
  type WarrantyDocumentRow,
} from "@/modules/warranties/repo";

const READ_ROLES = ["OWNER", "MANAGER", "TECHNICIAN", "ACCOUNTANT"] as const;
const WRITE_ROLES = ["OWNER", "MANAGER", "TECHNICIAN", "ACCOUNTANT"] as const;

async function withDownloadUrl(row: WarrantyDocumentRow) {
  let url: string | null = null;
  if (row.storageKey) {
    try {
      url = await createPresignedDownloadUrl(row.storageKey);
    } catch {
      url = null;
    }
  }
  return {
    ...row,
    required: partRequiresWarrantyCard(row.partName),
    url,
  };
}

export async function listVehicleWarranties(
  session: RoleSession,
  vehicleId: string,
) {
  requireRole(session, READ_ROLES);
  const vehicle = await findVehicleById(session.garageId, vehicleId);
  if (!vehicle) {
    throw new NotFoundError();
  }
  const rows = await listWarrantiesForVehicle(session.garageId, vehicleId);
  return Promise.all(rows.map(withDownloadUrl));
}

export async function listCustomerWarranties(
  session: RoleSession,
  customerId: string,
) {
  requireRole(session, READ_ROLES);
  const rows = await listWarrantiesForCustomer(session.garageId, customerId);
  return Promise.all(rows.map(withDownloadUrl));
}

export async function listInvoiceWarranties(
  session: RoleSession,
  invoiceId: string,
) {
  requireRole(session, READ_ROLES);
  const invoice = await findInvoiceById(session.garageId, invoiceId);
  if (!invoice) {
    throw new NotFoundError();
  }
  const rows = await listWarrantiesForInvoice(session.garageId, invoiceId);
  return Promise.all(rows.map(withDownloadUrl));
}

export async function requestWarrantyUploadUrl(
  session: RoleSession,
  raw: RequestWarrantyUploadInput,
) {
  requireRole(session, WRITE_ROLES);
  const input = requestWarrantyUploadSchema.parse(raw);
  const vehicle = await findVehicleById(session.garageId, input.vehicleId);
  if (!vehicle) {
    throw new NotFoundError();
  }

  const storageKey = buildVehicleWarrantyKey({
    garageId: session.garageId,
    vehicleId: vehicle.id,
    contentType: input.contentType,
  });

  try {
    const signed = await createPresignedUploadUrl({
      storageKey,
      contentType: input.contentType,
    });
    return {
      uploadUrl: signed.uploadUrl,
      storageKey: signed.storageKey,
      method: signed.method,
      fields: signed.fields,
    };
  } catch (error) {
    if (error instanceof AppError && error.code === "STORAGE_NOT_CONFIGURED") {
      throw new AppError("warranties.storage_not_configured", 500);
    }
    throw error;
  }
}

function assertPhotoRules(input: {
  partName: string;
  storageKey: string | null | undefined;
  warrantyExpiresAt: Date | null;
}) {
  const required = partRequiresWarrantyCard(input.partName);
  if (required) {
    if (!input.storageKey?.trim()) {
      throw new AppError("warranties.battery_photo_required", 400);
    }
    if (!input.warrantyExpiresAt) {
      throw new AppError("warranties.battery_expiry_required", 400);
    }
  }
}

export async function saveInvoiceLineWarranty(
  session: RoleSession,
  raw: SaveInvoiceLineWarrantyInput,
) {
  requireRole(session, WRITE_ROLES);
  const input = saveInvoiceLineWarrantySchema.parse(raw);

  const invoice = await findInvoiceById(session.garageId, input.invoiceId);
  if (!invoice) {
    throw new NotFoundError();
  }
  if (invoice.status !== "DRAFT") {
    throw new AppError("billing.invoice_immutable", 409);
  }

  const line = invoice.lines.find((item) => item.id === input.invoiceLineId);
  if (!line || line.type !== "PART") {
    throw new AppError("warranties.line_not_found", 404);
  }

  const order = await findVehicleContextForInvoice(session, invoice);
  const storageKey = input.storageKey?.trim() || null;

  if (storageKey) {
    if (!storageKeyBelongsToGarage(storageKey, session.garageId)) {
      throw new ForbiddenError();
    }
    if (!storageKey.includes(`/vehicles/${order.vehicleId}/warranty/`)) {
      throw new ForbiddenError();
    }
  }

  const warrantyExpiresAt = input.warrantyExpiresAt ?? null;

  // Partial saves are allowed (autosave while filling). Finalize still
  // requires battery photo + expiry via assertBatteryWarrantiesCompleteForInvoice.

  const previous = await findWarrantyByInvoiceLine(
    session.garageId,
    line.id,
  );
  const previousStorageKey = previous?.storageKey ?? null;

  const saved = await upsertInvoiceLineWarranty({
    garageId: session.garageId,
    vehicleId: order.vehicleId,
    customerId: order.customerId,
    partName: line.description,
    invoiceId: invoice.id,
    invoiceLineId: line.id,
    warrantyExpiresAt,
    storageKey,
    contentType: storageKey ? (input.contentType ?? null) : null,
    byteSize: storageKey ? (input.byteSize ?? null) : null,
    fileName: storageKey ? (input.fileName ?? null) : null,
    createdById: session.userId,
  });

  if (previousStorageKey && previousStorageKey !== storageKey) {
    try {
      await deleteStoredObject(previousStorageKey);
    } catch {
      // DB row is updated; storage cleanup is best-effort.
    }
  }

  return withDownloadUrl(saved);
}

export async function createVehicleWarranty(
  session: RoleSession,
  raw: CreateManualWarrantyInput,
) {
  requireRole(session, WRITE_ROLES);
  const input = createManualWarrantySchema.parse(raw);
  const vehicle = await findVehicleById(session.garageId, input.vehicleId);
  if (!vehicle) {
    throw new NotFoundError();
  }

  const storageKey = input.storageKey?.trim() || null;
  if (storageKey) {
    if (!storageKeyBelongsToGarage(storageKey, session.garageId)) {
      throw new ForbiddenError();
    }
    if (!storageKey.includes(`/vehicles/${vehicle.id}/warranty/`)) {
      throw new ForbiddenError();
    }
  }

  const warrantyExpiresAt = input.warrantyExpiresAt ?? null;

  assertPhotoRules({
    partName: input.partName,
    storageKey,
    warrantyExpiresAt,
  });

  if (!storageKey && !warrantyExpiresAt) {
    throw new AppError("warranties.empty_document", 400);
  }

  if (input.invoiceId) {
    const invoice = await findInvoiceById(session.garageId, input.invoiceId);
    if (!invoice) {
      throw new NotFoundError();
    }
    if (invoice.status !== "DRAFT") {
      throw new AppError("billing.invoice_immutable", 409);
    }
  }

  const saved = await createManualWarranty({
    garageId: session.garageId,
    vehicleId: vehicle.id,
    customerId: vehicle.customerId,
    partName: input.partName,
    invoiceId: input.invoiceId ?? null,
    warrantyExpiresAt,
    storageKey,
    contentType: storageKey ? (input.contentType ?? null) : null,
    byteSize: storageKey ? (input.byteSize ?? null) : null,
    fileName: storageKey ? (input.fileName ?? null) : null,
    createdById: session.userId,
  });

  return withDownloadUrl(saved);
}

export async function deleteWarrantyDocument(
  session: RoleSession,
  raw: DeleteWarrantyInput,
) {
  requireRole(session, WRITE_ROLES);
  const input = deleteWarrantySchema.parse(raw);
  const existing = await findWarrantyById(session.garageId, input.warrantyId);
  if (!existing) {
    throw new NotFoundError();
  }

  if (existing.invoiceId) {
    const invoice = await findInvoiceById(session.garageId, existing.invoiceId);
    if (invoice?.status === "FINALIZED") {
      throw new AppError("warranties.locked_on_finalized_invoice", 409);
    }
  }

  const removed = await deleteWarrantyById(
    session.garageId,
    input.warrantyId,
    session.userId,
  );
  if (!removed) {
    throw new NotFoundError();
  }
  if (removed.storageKey) {
    try {
      await deleteStoredObject(removed.storageKey);
    } catch {
      // Keep DB delete even if object cleanup fails.
    }
  }
  return removed;
}

/**
 * Blocks finalize when any PART line whose name contains "battery"
 * is missing a warranty card photo or expiry date.
 */
export async function assertBatteryWarrantiesCompleteForInvoice(
  garageId: string,
  invoiceId: string,
) {
  const invoice = await findInvoiceById(garageId, invoiceId);
  if (!invoice) {
    throw new NotFoundError();
  }

  const docs = await listWarrantiesForInvoice(garageId, invoiceId);
  const byLine = new Map(
    docs
      .filter((doc) => doc.invoiceLineId)
      .map((doc) => [doc.invoiceLineId!, doc]),
  );

  for (const line of invoice.lines) {
    if (line.type !== "PART") continue;
    if (!partRequiresWarrantyCard(line.description)) continue;

    const doc = byLine.get(line.id);
    if (!doc?.storageKey || !doc.warrantyExpiresAt) {
      throw new AppError("warranties.battery_details_required", 400, {
        partName: line.description,
      });
    }
  }
}

async function findVehicleContextForInvoice(
  session: RoleSession,
  invoice: NonNullable<Awaited<ReturnType<typeof findInvoiceById>>>,
) {
  const order = await findServiceOrderById(
    session.garageId,
    invoice.serviceOrderId,
  );
  if (!order) {
    throw new NotFoundError();
  }
  return {
    vehicleId: order.vehicleId,
    customerId: order.customerId,
  };
}

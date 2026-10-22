import "server-only";

import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { requireRole, type RoleSession } from "@/lib/rbac";
import {
  buildInspectionMediaKey,
  createPresignedDownloadUrl,
  createPresignedUploadUrl,
  deleteStoredObject,
  storageKeyBelongsToGarage,
} from "@/lib/storage";
import {
  addChecklistItemSchema,
  addSuggestedRepairSchema,
  assertMediaLimits,
  confirmMediaSchema,
  createUploadUrlSchema,
  updateInspectionItemSchema,
  type AddChecklistItemInput,
  type AddSuggestedRepairInput,
  type ConfirmMediaInput,
  type CreateUploadUrlInput,
  type UpdateInspectionItemInput,
} from "@/modules/inspections/schema";
import {
  addCustomChecklistItem,
  createInspectionWithDefaults,
  createMediaRecord,
  createSuggestedRepair,
  deleteMediaById,
  deleteSuggestedRepairById,
  findInspectionByServiceOrderId,
  findInspectionItemById,
  findMediaById,
  findSuggestedRepairById,
  updateInspectionItemById,
} from "@/modules/inspections/repo";
import { findServiceOrderById } from "@/modules/service-orders/repo";

const WRITE_ROLES = ["OWNER", "MANAGER", "TECHNICIAN"] as const;
const READ_ROLES = ["OWNER", "MANAGER", "TECHNICIAN", "ACCOUNTANT"] as const;

function assertCanViewOrder(
  session: RoleSession,
  order: { technicianId: string | null },
) {
  if (session.role === "TECHNICIAN" && order.technicianId !== session.userId) {
    throw new ForbiddenError();
  }
}

function assertCanMutateOrder(
  session: RoleSession,
  order: { technicianId: string | null; status: string },
) {
  if (session.role === "ACCOUNTANT") {
    throw new ForbiddenError();
  }
  if (session.role === "TECHNICIAN" && order.technicianId !== session.userId) {
    throw new ForbiddenError();
  }
  if (order.status === "COMPLETED") {
    throw new AppError("ORDER_COMPLETED", 409);
  }
}

type InspectionDetail = NonNullable<
  Awaited<ReturnType<typeof findInspectionByServiceOrderId>>
>;

async function withMediaUrls(inspection: InspectionDetail) {
  const items = await Promise.all(
    inspection.items.map(async (item) => ({
      ...item,
      media: await Promise.all(
        item.media.map(async (m) => ({
          ...m,
          url: await createPresignedDownloadUrl(m.storageKey),
        })),
      ),
    })),
  );
  return { ...inspection, items };
}

async function loadOrderForSession(session: RoleSession, orderId: string) {
  const order = await findServiceOrderById(session.garageId, orderId);
  if (!order) {
    throw new NotFoundError();
  }
  return order;
}

/** Get or create the inspection for a service order (seeds default checklist). */
export async function getOrCreateInspection(
  session: RoleSession,
  serviceOrderId: string,
) {
  requireRole(session, READ_ROLES);
  const order = await loadOrderForSession(session, serviceOrderId);
  assertCanViewOrder(session, order);

  const existing = await findInspectionByServiceOrderId(
    session.garageId,
    order.id,
  );
  if (existing) {
    return await withMediaUrls(existing);
  }

  // Creating requires write access; readers see empty until someone starts it.
  if (session.role === "ACCOUNTANT") {
    return null;
  }

  assertCanMutateOrder(session, order);
  const created = await createInspectionWithDefaults(session.garageId, {
    serviceOrderId: order.id,
    actorId: session.userId,
  });
  if (!created) {
    throw new AppError("INSPECTION_CREATE_FAILED", 500);
  }
  return await withMediaUrls(created);
}

export async function getInspectionForOrder(
  session: RoleSession,
  serviceOrderId: string,
) {
  requireRole(session, READ_ROLES);
  const order = await loadOrderForSession(session, serviceOrderId);
  assertCanViewOrder(session, order);
  const inspection = await findInspectionByServiceOrderId(
    session.garageId,
    order.id,
  );
  return inspection ? await withMediaUrls(inspection) : null;
}

export async function updateInspectionItem(
  session: RoleSession,
  itemId: string,
  raw: UpdateInspectionItemInput,
) {
  requireRole(session, WRITE_ROLES);
  const input = updateInspectionItemSchema.parse(raw);

  const item = await findInspectionItemById(session.garageId, itemId);
  if (!item) {
    throw new NotFoundError();
  }

  const order = await loadOrderForSession(session, item.inspection.serviceOrderId);
  assertCanMutateOrder(session, order);

  const updated = await updateInspectionItemById(session.garageId, itemId, {
    result: input.result,
    notes: input.notes,
    actorId: session.userId,
    serviceOrderId: order.id,
  });
  if (!updated) {
    throw new NotFoundError();
  }
  return updated;
}

export async function addChecklistItem(
  session: RoleSession,
  serviceOrderId: string,
  raw: AddChecklistItemInput,
) {
  requireRole(session, WRITE_ROLES);
  const input = addChecklistItemSchema.parse(raw);

  const order = await loadOrderForSession(session, serviceOrderId);
  assertCanMutateOrder(session, order);

  let inspection = await findInspectionByServiceOrderId(
    session.garageId,
    order.id,
  );
  if (!inspection) {
    inspection = await createInspectionWithDefaults(session.garageId, {
      serviceOrderId: order.id,
      actorId: session.userId,
    });
  }
  if (!inspection) {
    throw new AppError("INSPECTION_CREATE_FAILED", 500);
  }

  return addCustomChecklistItem(session.garageId, {
    inspectionId: inspection.id,
    serviceOrderId: order.id,
    label: input.label,
    actorId: session.userId,
  });
}

export async function createMediaUploadUrl(
  session: RoleSession,
  raw: CreateUploadUrlInput,
) {
  requireRole(session, WRITE_ROLES);
  const input = createUploadUrlSchema.parse(raw);
  try {
    assertMediaLimits(input.kind, input.contentType, input.byteSize);
  } catch {
    throw new AppError("MEDIA_INVALID", 400);
  }

  const item = await findInspectionItemById(
    session.garageId,
    input.inspectionItemId,
  );
  if (!item) {
    throw new NotFoundError();
  }

  const order = await loadOrderForSession(session, item.inspection.serviceOrderId);
  assertCanMutateOrder(session, order);

  const storageKey = buildInspectionMediaKey({
    garageId: session.garageId,
    inspectionId: item.inspectionId,
    itemId: item.id,
    contentType: input.contentType,
  });

  const signed = await createPresignedUploadUrl({
    storageKey,
    contentType: input.contentType,
  });

  return {
    uploadUrl: signed.uploadUrl,
    storageKey: signed.storageKey,
    contentType: input.contentType,
    kind: input.kind,
    inspectionItemId: item.id,
  };
}

export async function confirmMediaUpload(
  session: RoleSession,
  raw: ConfirmMediaInput,
) {
  requireRole(session, WRITE_ROLES);
  const input = confirmMediaSchema.parse(raw);
  try {
    assertMediaLimits(input.kind, input.contentType, input.byteSize);
  } catch {
    throw new AppError("MEDIA_INVALID", 400);
  }

  if (!storageKeyBelongsToGarage(input.storageKey, session.garageId)) {
    throw new ForbiddenError();
  }

  const item = await findInspectionItemById(
    session.garageId,
    input.inspectionItemId,
  );
  if (!item) {
    throw new NotFoundError();
  }

  if (!input.storageKey.includes(`/items/${item.id}/`)) {
    throw new ForbiddenError();
  }

  const order = await loadOrderForSession(session, item.inspection.serviceOrderId);
  assertCanMutateOrder(session, order);

  const media = await createMediaRecord(session.garageId, {
    inspectionId: item.inspectionId,
    inspectionItemId: item.id,
    serviceOrderId: order.id,
    kind: input.kind,
    storageKey: input.storageKey,
    contentType: input.contentType,
    byteSize: input.byteSize,
    actorId: session.userId,
  });

  return {
    ...media,
    url: await createPresignedDownloadUrl(media.storageKey),
  };
}

export async function removeMedia(session: RoleSession, mediaId: string) {
  requireRole(session, WRITE_ROLES);

  const existing = await findMediaById(session.garageId, mediaId);
  if (!existing) {
    throw new NotFoundError();
  }

  const order = await loadOrderForSession(
    session,
    existing.inspection.serviceOrderId,
  );
  assertCanMutateOrder(session, order);

  const removed = await deleteMediaById(session.garageId, mediaId, {
    actorId: session.userId,
    serviceOrderId: order.id,
  });
  if (!removed) {
    throw new NotFoundError();
  }

  try {
    await deleteStoredObject(removed.storageKey);
  } catch {
    // DB row is gone; storage cleanup is best-effort.
  }

  return removed;
}

export async function addSuggestedRepairLine(
  session: RoleSession,
  serviceOrderId: string,
  raw: AddSuggestedRepairInput,
) {
  requireRole(session, WRITE_ROLES);
  const input = addSuggestedRepairSchema.parse(raw);

  const order = await loadOrderForSession(session, serviceOrderId);
  assertCanMutateOrder(session, order);

  let inspection = await findInspectionByServiceOrderId(
    session.garageId,
    order.id,
  );
  if (!inspection) {
    inspection = await createInspectionWithDefaults(session.garageId, {
      serviceOrderId: order.id,
      actorId: session.userId,
    });
  }
  if (!inspection) {
    throw new AppError("INSPECTION_CREATE_FAILED", 500);
  }

  return createSuggestedRepair(session.garageId, {
    inspectionId: inspection.id,
    serviceOrderId: order.id,
    type: input.type,
    description: input.description,
    quantity: input.quantity,
    unitPricePaise: input.unitPricePaise,
    actorId: session.userId,
  });
}

export async function removeSuggestedRepair(
  session: RoleSession,
  repairId: string,
) {
  requireRole(session, WRITE_ROLES);

  const existing = await findSuggestedRepairById(session.garageId, repairId);
  if (!existing) {
    throw new NotFoundError();
  }

  const order = await loadOrderForSession(
    session,
    existing.inspection.serviceOrderId,
  );
  assertCanMutateOrder(session, order);

  const deleted = await deleteSuggestedRepairById(session.garageId, repairId, {
    actorId: session.userId,
    serviceOrderId: order.id,
  });
  if (!deleted) {
    throw new NotFoundError();
  }

  return deleted;
}

/** Test helper: cross-garage read attempt. */
export async function getInspectionForGarageId(
  session: RoleSession,
  requestedGarageId: string,
  serviceOrderId: string,
) {
  if (requestedGarageId !== session.garageId) {
    throw new ForbiddenError();
  }
  return getInspectionForOrder(session, serviceOrderId);
}

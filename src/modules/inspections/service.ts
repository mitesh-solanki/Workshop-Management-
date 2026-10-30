import "server-only";

import { Prisma } from "@prisma/client";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { requireRole, type RoleSession } from "@/lib/rbac";
import {
  buildInspectionMediaKey,
  createPresignedDownloadUrl,
  createPresignedUploadUrl,
  deleteStoredObject,
  storageKeyBelongsToGarage,
} from "@/lib/storage";
import { deriveInspectionApprovalStatus } from "@/modules/inspections/approval-status";
import {
  addChecklistItemSchema,
  addSuggestedRepairSchema,
  assertMediaLimits,
  confirmMediaSchema,
  createInspectionSchema,
  createUploadUrlSchema,
  saveInspectionItemsJsonSchema,
  saveInspectionSchema,
  updateInspectionItemSchema,
  updateInspectionNotesSchema,
  type AddChecklistItemInput,
  type AddSuggestedRepairInput,
  type ConfirmMediaInput,
  type CreateInspectionInput,
  type CreateUploadUrlInput,
  type SaveInspectionInput,
  type UpdateInspectionItemInput,
  type UpdateInspectionNotesInput,
} from "@/modules/inspections/schema";
import { isTechnicianAssignedToOrder } from "@/modules/service-orders/technicians";
import {
  addCustomChecklistItem,
  createInspectionWithDefaults,
  createInspectionWithDetails,
  createMediaRecord,
  createSuggestedRepair,
  deleteInspectionById,
  deleteMediaById,
  deleteSuggestedRepairById,
  findInspectionById,
  findInspectionByServiceOrderId,
  findInspectionItemById,
  findMediaById,
  findSuggestedRepairById,
  linkInspectionToServiceOrder,
  listInspections,
  saveInspectionDetails,
  updateInspectionItemById,
  updateInspectionNotesById,
  type InspectionListFilters,
} from "@/modules/inspections/repo";
import { findPartById } from "@/modules/inventory/repo";
import { findCustomerById } from "@/modules/customers/repo";
import { findVehicleById } from "@/modules/vehicles/repo";
import { findServiceOrderById } from "@/modules/service-orders/repo";

const WRITE_ROLES = ["OWNER", "MANAGER"] as const;
const READ_ROLES = ["OWNER", "MANAGER", "ACCOUNTANT"] as const;
const CREATE_ROLES = ["OWNER", "MANAGER"] as const;

type LinkedOrder = {
  id: string;
  technicianId: string | null;
  status: string;
  technicianAssignments?: Array<{ technicianId: string }>;
};

function assertCanViewLinkedOrder(
  session: RoleSession,
  order: {
    technicianId: string | null;
    technicianAssignments?: Array<{ technicianId: string }>;
  },
) {
  if (
    session.role === "TECHNICIAN" &&
    !isTechnicianAssignedToOrder(order, session.userId)
  ) {
    throw new ForbiddenError();
  }
}

function assertCanMutateLinkedOrder(
  session: RoleSession,
  order: {
    technicianId: string | null;
    status: string;
    technicianAssignments?: Array<{ technicianId: string }>;
  },
) {
  if (session.role === "ACCOUNTANT") {
    throw new ForbiddenError();
  }
  if (
    session.role === "TECHNICIAN" &&
    !isTechnicianAssignedToOrder(order, session.userId)
  ) {
    throw new ForbiddenError();
  }
  if (order.status === "COMPLETED") {
    throw new AppError("ORDER_COMPLETED");
  }
}

function assertCanViewInspection(
  session: RoleSession,
  inspection: {
    serviceOrder: LinkedOrder | null;
  },
) {
  if (inspection.serviceOrder) {
    assertCanViewLinkedOrder(session, inspection.serviceOrder);
  }
}

function assertCanMutateInspection(
  session: RoleSession,
  inspection: {
    serviceOrder: LinkedOrder | null;
  },
) {
  if (session.role === "ACCOUNTANT") {
    throw new ForbiddenError();
  }
  if (inspection.serviceOrder) {
    assertCanMutateLinkedOrder(session, inspection.serviceOrder);
  }
}

type InspectionDetail = NonNullable<
  Awaited<ReturnType<typeof findInspectionById>>
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

async function loadInspectionForSession(
  session: RoleSession,
  inspectionId: string,
) {
  const inspection = await findInspectionById(session.garageId, inspectionId);
  if (!inspection) {
    throw new NotFoundError();
  }
  return inspection;
}

function withApprovalStatus<
  T extends {
    estimates: Array<{
      askPermission: boolean;
      lines: Array<{ approvalState: "PENDING" | "APPROVED" | "REJECTED" }>;
    }>;
  },
>(item: T) {
  const current = item.estimates?.[0] ?? null;
  return {
    ...item,
    approvalStatus: deriveInspectionApprovalStatus(current),
  };
}

export async function listGarageInspections(
  session: RoleSession,
  filters: InspectionListFilters = {},
) {
  requireRole(session, READ_ROLES);
  const result = await listInspections(session.garageId, filters);
  return {
    ...result,
    items: result.items.map(withApprovalStatus),
  };
}

export async function listCustomerInspections(
  session: RoleSession,
  customerId: string,
) {
  requireRole(session, READ_ROLES);
  const customer = await findCustomerById(session.garageId, customerId);
  if (!customer) {
    throw new NotFoundError();
  }
  const result = await listInspections(session.garageId, {
    customerId,
    pageSize: 100,
  });
  return result.items.map(withApprovalStatus);
}

export async function listVehicleInspections(
  session: RoleSession,
  vehicleId: string,
) {
  requireRole(session, READ_ROLES);
  const vehicle = await findVehicleById(session.garageId, vehicleId);
  if (!vehicle) {
    throw new NotFoundError();
  }
  const result = await listInspections(session.garageId, {
    vehicleId,
    pageSize: 100,
  });
  return result.items.map(withApprovalStatus);
}

export async function getInspection(
  session: RoleSession,
  inspectionId: string,
) {
  requireRole(session, READ_ROLES);
  const inspection = await loadInspectionForSession(session, inspectionId);
  assertCanViewInspection(session, inspection);
  return withMediaUrls(inspection);
}

export async function deleteInspection(
  session: RoleSession,
  inspectionId: string,
) {
  requireRole(session, CREATE_ROLES);
  const inspection = await findInspectionById(session.garageId, inspectionId);
  if (!inspection) {
    throw new NotFoundError();
  }
  assertCanMutateInspection(session, inspection);

  const result = await deleteInspectionById(
    session.garageId,
    inspectionId,
    session.userId,
  );
  if (result === "not_found") {
    throw new NotFoundError();
  }
  return {
    customerId: inspection.customerId,
    vehicleId: inspection.vehicleId,
  };
}

async function assertVehicleCustomerMatch(
  session: RoleSession,
  customerId: string,
  vehicleId: string,
) {
  const vehicle = await findVehicleById(session.garageId, vehicleId);
  if (!vehicle) {
    throw new NotFoundError();
  }
  if (vehicle.customerId !== customerId) {
    throw new AppError("inspections.vehicle_customer_mismatch", 400);
  }
  return vehicle;
}

export async function createInspection(
  session: RoleSession,
  raw: CreateInspectionInput,
) {
  requireRole(session, CREATE_ROLES);
  const input = createInspectionSchema.parse(raw);
  await assertVehicleCustomerMatch(
    session,
    input.customerId,
    input.vehicleId,
  );

  const created = await createInspectionWithDefaults(session.garageId, {
    customerId: input.customerId,
    vehicleId: input.vehicleId,
    actorId: session.userId,
  });
  if (!created) {
    throw new AppError("INSPECTION_CREATE_FAILED");
  }
  return withMediaUrls(created);
}

export async function saveNewInspection(
  session: RoleSession,
  raw: SaveInspectionInput,
) {
  requireRole(session, CREATE_ROLES);
  const input = saveInspectionSchema.parse(raw);
  await assertVehicleCustomerMatch(
    session,
    input.customerId,
    input.vehicleId,
  );

  const created = await createInspectionWithDetails(session.garageId, {
    customerId: input.customerId,
    vehicleId: input.vehicleId,
    complaint: input.complaint,
    recommendedNotes: input.recommendedNotes,
    expectedCompletion: input.expectedCompletion,
    items: input.items,
    actorId: session.userId,
  });
  if (!created) {
    throw new AppError("INSPECTION_CREATE_FAILED");
  }
  return withMediaUrls(created);
}

export async function saveExistingInspection(
  session: RoleSession,
  inspectionId: string,
  raw: SaveInspectionInput,
) {
  requireRole(session, WRITE_ROLES);
  const input = saveInspectionSchema.parse(raw);
  const inspection = await loadInspectionForSession(session, inspectionId);
  assertCanMutateInspection(session, inspection);

  if (
    inspection.customerId !== input.customerId ||
    inspection.vehicleId !== input.vehicleId
  ) {
    throw new AppError("inspections.vehicle_customer_mismatch", 400);
  }

  const saved = await saveInspectionDetails(session.garageId, inspection.id, {
    complaint: input.complaint,
    recommendedNotes: input.recommendedNotes,
    expectedCompletion: input.expectedCompletion,
    items: input.items,
    actorId: session.userId,
  });
  if (!saved) {
    throw new NotFoundError();
  }
  return withMediaUrls(saved);
}

export function parseInspectionItemsJson(raw: string) {
  return saveInspectionItemsJsonSchema.parse(raw);
}

export async function linkInspectionToOrder(
  session: RoleSession,
  inspectionId: string,
  serviceOrderId: string,
) {
  requireRole(session, ["OWNER", "MANAGER"]);
  const inspection = await loadInspectionForSession(session, inspectionId);
  if (inspection.serviceOrderId) {
    throw new AppError("inspections.already_linked", 400);
  }

  const order = await loadOrderForSession(session, serviceOrderId);
  if (
    order.customerId !== inspection.customerId ||
    order.vehicleId !== inspection.vehicleId
  ) {
    throw new AppError("inspections.link_mismatch", 400);
  }

  const existing = await findInspectionByServiceOrderId(
    session.garageId,
    order.id,
  );
  if (existing) {
    throw new AppError("inspections.order_has_inspection", 400);
  }

  const linked = await linkInspectionToServiceOrder(
    session.garageId,
    inspection.id,
    {
      serviceOrderId: order.id,
      actorId: session.userId,
    },
  );
  if (!linked) {
    throw new AppError("inspections.link_failed", 400);
  }
  return withMediaUrls(linked);
}

/** Get or create the inspection for a service order (starts with no items). */
export async function getOrCreateInspection(
  session: RoleSession,
  serviceOrderId: string,
) {
  requireRole(session, READ_ROLES);
  const order = await loadOrderForSession(session, serviceOrderId);
  assertCanViewLinkedOrder(session, order);

  const existing = await findInspectionByServiceOrderId(
    session.garageId,
    order.id,
  );
  if (existing) {
    return await withMediaUrls(existing);
  }

  if (session.role === "ACCOUNTANT") {
    return null;
  }

  assertCanMutateLinkedOrder(session, order);
  try {
    const created = await createInspectionWithDefaults(session.garageId, {
      customerId: order.customerId,
      vehicleId: order.vehicleId,
      serviceOrderId: order.id,
      actorId: session.userId,
    });
    if (!created) {
      throw new AppError("INSPECTION_CREATE_FAILED");
    }
    return await withMediaUrls(created);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const raced = await findInspectionByServiceOrderId(
        session.garageId,
        order.id,
      );
      if (raced) {
        return await withMediaUrls(raced);
      }
    }
    throw error;
  }
}

export async function getInspectionForOrder(
  session: RoleSession,
  serviceOrderId: string,
) {
  requireRole(session, READ_ROLES);
  const order = await loadOrderForSession(session, serviceOrderId);
  assertCanViewLinkedOrder(session, order);
  const inspection = await findInspectionByServiceOrderId(
    session.garageId,
    order.id,
  );
  return inspection ? await withMediaUrls(inspection) : null;
}

export async function updateInspectionNotes(
  session: RoleSession,
  inspectionId: string,
  raw: UpdateInspectionNotesInput,
) {
  requireRole(session, WRITE_ROLES);
  const input = updateInspectionNotesSchema.parse(raw);

  const inspection = await loadInspectionForSession(session, inspectionId);
  assertCanMutateInspection(session, inspection);

  const updated = await updateInspectionNotesById(
    session.garageId,
    inspection.id,
    {
      complaint: input.complaint,
      recommendedNotes: input.recommendedNotes,
      actorId: session.userId,
    },
  );
  if (!updated) {
    throw new NotFoundError();
  }
  return withMediaUrls(updated);
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

  assertCanMutateInspection(session, item.inspection);

  const updated = await updateInspectionItemById(session.garageId, itemId, {
    result: input.result,
    notes: input.notes,
    quantity: input.quantity,
    unitPricePaise: input.unitPricePaise,
    externalCheck: input.externalCheck,
    label: input.label,
    actorId: session.userId,
    inspectionId: item.inspectionId,
    serviceOrderId: item.inspection.serviceOrderId,
  });
  if (!updated) {
    throw new NotFoundError();
  }
  return updated;
}

export async function addChecklistItem(
  session: RoleSession,
  inspectionId: string,
  raw: AddChecklistItemInput,
) {
  requireRole(session, WRITE_ROLES);
  const input = addChecklistItemSchema.parse(raw);

  const inspection = await loadInspectionForSession(session, inspectionId);
  assertCanMutateInspection(session, inspection);

  return addCustomChecklistItem(session.garageId, {
    inspectionId: inspection.id,
    serviceOrderId: inspection.serviceOrderId,
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
    throw new AppError("MEDIA_INVALID");
  }

  const item = await findInspectionItemById(
    session.garageId,
    input.inspectionItemId,
  );
  if (!item) {
    throw new NotFoundError();
  }

  assertCanMutateInspection(session, item.inspection);

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
    method: signed.method,
    fields: signed.fields,
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
    throw new AppError("MEDIA_INVALID");
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

  assertCanMutateInspection(session, item.inspection);

  const media = await createMediaRecord(session.garageId, {
    inspectionId: item.inspectionId,
    inspectionItemId: item.id,
    serviceOrderId: item.inspection.serviceOrderId,
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

  assertCanMutateInspection(session, existing.inspection);

  const removed = await deleteMediaById(session.garageId, mediaId, {
    actorId: session.userId,
    inspectionId: existing.inspection.id,
    serviceOrderId: existing.inspection.serviceOrderId,
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
  inspectionId: string,
  raw: AddSuggestedRepairInput,
) {
  requireRole(session, WRITE_ROLES);
  const input = addSuggestedRepairSchema.parse(raw);

  const inspection = await loadInspectionForSession(session, inspectionId);
  assertCanMutateInspection(session, inspection);

  if (input.type === "PART") {
    if (!input.partId) {
      throw new AppError("inventory.part_required", 400);
    }
    const part = await findPartById(session.garageId, input.partId);
    if (!part) {
      throw new NotFoundError();
    }
  }

  return createSuggestedRepair(session.garageId, {
    inspectionId: inspection.id,
    serviceOrderId: inspection.serviceOrderId,
    type: input.type,
    description: input.description,
    quantity: input.quantity,
    unitPricePaise: input.unitPricePaise,
    partId: input.type === "PART" ? input.partId : null,
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

  assertCanMutateInspection(session, existing.inspection);

  const deleted = await deleteSuggestedRepairById(session.garageId, repairId, {
    actorId: session.userId,
    inspectionId: existing.inspection.id,
    serviceOrderId: existing.inspection.serviceOrderId,
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

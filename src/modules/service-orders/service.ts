import "server-only";

import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { requireRole, type RoleSession } from "@/lib/rbac";
import {
  buildOutsideWorkBillKey,
  buildServiceOrderPaperCopyKey,
  createPresignedDownloadUrl,
  createPresignedUploadUrl,
  deleteStoredObject,
  storageKeyBelongsToGarage,
} from "@/lib/storage";
import { findBayById } from "@/modules/bays/repo";
import {
  findInspectionById,
  findLatestVehicleInspectionDue,
  linkInspectionToServiceOrder,
} from "@/modules/inspections/repo";
import { findLatestCurrentEstimateForCustomerVehicle } from "@/modules/estimates/repo";
import { findVehicleById } from "@/modules/vehicles/repo";
import {
  addServiceOrderLineSchema,
  assertOutsideWorkBillLimits,
  assertPaperCopyLimits,
  canTransitionStatus,
  computeBayOccupancy,
  confirmOutsideWorkBillSchema,
  confirmPaperCopySchema,
  createOutsideWorkBillUploadUrlSchema,
  createPaperCopyUploadUrlSchema,
  createServiceOrderSchema,
  MAX_PAPER_COPIES_PER_ORDER,
  removePaperCopySchema,
  replacePaperCopySchema,
  updateServiceOrderLineSchema,
  updateServiceOrderSchema,
  updateServiceOrderStatusSchema,
  type AddServiceOrderLineInput,
  type ConfirmOutsideWorkBillInput,
  type ConfirmPaperCopyInput,
  type CreateOutsideWorkBillUploadUrlInput,
  type CreatePaperCopyUploadUrlInput,
  type CreateServiceOrderInput,
  type RemovePaperCopyInput,
  type ReplacePaperCopyInput,
  type ServiceOrderStatusValue,
  type UpdateServiceOrderInput,
  type UpdateServiceOrderLineInput,
  type UpdateServiceOrderStatusInput,
} from "@/modules/service-orders/schema";
import { calendarDaysAheadBoundsUtc } from "@/lib/calendar-day";
import {
  countOverdueServiceOrders,
  countPaperCopiesForOrder,
  countServiceOrdersByStatus,
  createPaperCopy,
  createServiceOrder,
  createServiceOrderLine,
  deletePaperCopy,
  deleteServiceOrderById,
  deleteServiceOrderLine,
  applyCataloguePricesToUnpricedPartLines,
  findServiceOrderById,
  findTechnicianInGarage,
  getNextJobCardNumber,
  JobCardNumberConflictError,
  listPaperCopiesForOrder,
  listServiceOrderAuditLogs,
  listServiceOrders,
  listServiceOrdersByCustomer,
  listServiceOrdersByStatus,
  listServiceOrdersByVehicle,
  listServiceOrdersDueInWindow,
  listServiceOrdersNeedingPricing,
  listTechniciansInGarage,
  replacePaperCopy,
  setNextJobCardNumberSeed,
  setOutsideWorkBill,
  updateServiceOrderDetails,
  updateServiceOrderLine,
  updateServiceOrderStatus,
} from "@/modules/service-orders/repo";
import {
  isTechnicianAssignedToOrder,
  technicianIdsFromOrder,
} from "@/modules/service-orders/technicians";

async function resolveBayFilterName(
  garageId: string,
  options: { bay?: string; bayId?: string },
): Promise<string | undefined> {
  const bayName = options.bay?.trim() || undefined;
  if (bayName) {
    return bayName;
  }
  const bayId = options.bayId?.trim() || undefined;
  if (!bayId) {
    return undefined;
  }
  const bay = await findBayById(garageId, bayId);
  return bay?.name;
}

const CREATE_ROLES = ["OWNER", "MANAGER"] as const;
const MANAGE_ROLES = ["OWNER", "MANAGER"] as const;
const LINE_ROLES = ["OWNER", "MANAGER", "TECHNICIAN"] as const;
const READ_ROLES = ["OWNER", "MANAGER", "TECHNICIAN", "ACCOUNTANT"] as const;

function assertCanViewOrder(
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

function assertCanMutateOrder(
  session: RoleSession,
  order: {
    technicianId: string | null;
    status: ServiceOrderStatusValue;
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
    throw new AppError("ORDER_COMPLETED", 409);
  }
}

export async function listAssignableTechnicians(session: RoleSession) {
  requireRole(session, CREATE_ROLES);
  return listTechniciansInGarage(session.garageId);
}

/** Technicians for the workshop board filter (not for assignment). */
export async function listBoardTechnicians(session: RoleSession) {
  requireRole(session, READ_ROLES);
  if (session.role === "TECHNICIAN") {
    return [];
  }
  return listTechniciansInGarage(session.garageId);
}

export async function listOrders(
  session: RoleSession,
  options: { technicianId?: string; bay?: string; bayId?: string } = {},
) {
  requireRole(session, READ_ROLES);

  const bay = await resolveBayFilterName(session.garageId, options);

  if (session.role === "TECHNICIAN") {
    return listServiceOrders(session.garageId, {
      technicianId: session.userId,
      ...(bay ? { bay } : {}),
    });
  }

  const technicianId = options.technicianId?.trim() || undefined;
  return listServiceOrders(session.garageId, {
    ...(technicianId ? { technicianId } : {}),
    ...(bay ? { bay } : {}),
  });
}

export async function getDashboardOrderCounts(session: RoleSession) {
  requireRole(session, READ_ROLES);

  const scope =
    session.role === "TECHNICIAN"
      ? { technicianId: session.userId }
      : {};

  const [statusCounts, overdueCount] = await Promise.all([
    countServiceOrdersByStatus(session.garageId, scope),
    countOverdueServiceOrders(session.garageId, scope),
  ]);

  return { statusCounts, overdueCount };
}

/** Home queue — open jobs with expected completion today or tomorrow. */
export async function listDashboardDueSoonOrders(session: RoleSession) {
  requireRole(session, ["OWNER", "MANAGER", "TECHNICIAN"]);

  const scope =
    session.role === "TECHNICIAN"
      ? { technicianId: session.userId }
      : {};
  const window = calendarDaysAheadBoundsUtc(1);

  return listServiceOrdersDueInWindow(session.garageId, window, scope);
}

/** @deprecated Prefer listDashboardDueSoonOrders. */
export async function listDashboardTodayOrders(session: RoleSession) {
  return listDashboardDueSoonOrders(session);
}

/** Home queue — open jobs with unpriced part lines (mechanic-added, no price yet). */
export async function listDashboardNeedsPricingOrders(session: RoleSession) {
  requireRole(session, ["OWNER", "MANAGER", "TECHNICIAN"]);
  const scope =
    session.role === "TECHNICIAN"
      ? { technicianId: session.userId }
      : {};
  return listServiceOrdersNeedingPricing(session.garageId, scope);
}

/** @deprecated Prefer listDashboardNeedsPricingOrders. */
export async function listDashboardPartsNeededOrders(session: RoleSession) {
  return listDashboardNeedsPricingOrders(session);
}

/** Home queue — cars ready for customer delivery. */
export async function listDashboardReadyOrders(session: RoleSession) {
  requireRole(session, ["OWNER", "MANAGER", "TECHNICIAN"]);
  const scope =
    session.role === "TECHNICIAN"
      ? { technicianId: session.userId }
      : {};
  return listServiceOrdersByStatus(session.garageId, "READY", scope);
}

/** Bay chips for the board — scoped by technician filter only (not by selected bay). */
export async function getBayOccupancy(
  session: RoleSession,
  options: { technicianId?: string } = {},
) {
  const orders = await listOrders(session, {
    ...(options.technicianId ? { technicianId: options.technicianId } : {}),
  });
  return computeBayOccupancy(orders);
}

/** Customer service history, scoped for technicians to their assignments. */
export async function listCustomerServiceHistory(
  session: RoleSession,
  customerId: string,
) {
  requireRole(session, READ_ROLES);

  const rows = await listServiceOrdersByCustomer(
    session.garageId,
    customerId,
    session.role === "TECHNICIAN" ? { technicianId: session.userId } : {},
  );
  return Promise.all(
    rows.map(async (order) => {
      const paperCopies = await Promise.all(
        order.paperCopies.map(async (copy) => {
          let url: string | null = null;
          try {
            url = await createPresignedDownloadUrl(copy.storageKey);
          } catch {
            url = null;
          }
          return {
            id: copy.id,
            contentType: copy.contentType,
            fileName: copy.fileName,
            url,
          };
        }),
      );
      return {
        ...order,
        paperCopies,
        paperCopyCount: paperCopies.length,
      };
    }),
  );
}

/** Vehicle service history, scoped for technicians to their assignments. */
export async function listVehicleServiceHistory(
  session: RoleSession,
  vehicleId: string,
) {
  requireRole(session, READ_ROLES);

  const vehicle = await findVehicleById(session.garageId, vehicleId);
  if (!vehicle) {
    throw new NotFoundError();
  }

  const rows = await listServiceOrdersByVehicle(
    session.garageId,
    vehicleId,
    session.role === "TECHNICIAN" ? { technicianId: session.userId } : {},
  );
  return Promise.all(
    rows.map(async (order) => {
      const paperCopies = await Promise.all(
        order.paperCopies.map(async (copy) => {
          let url: string | null = null;
          try {
            url = await createPresignedDownloadUrl(copy.storageKey);
          } catch {
            url = null;
          }
          return {
            id: copy.id,
            contentType: copy.contentType,
            fileName: copy.fileName,
            url,
          };
        }),
      );
      return {
        ...order,
        paperCopies,
        paperCopyCount: paperCopies.length,
      };
    }),
  );
}

export async function getOrder(session: RoleSession, orderId: string) {
  requireRole(session, READ_ROLES);
  const order = await findServiceOrderById(session.garageId, orderId);
  if (!order) {
    throw new NotFoundError();
  }
  assertCanViewOrder(session, order);

  if (
    (session.role === "OWNER" || session.role === "MANAGER") &&
    order.status !== "COMPLETED"
  ) {
    const applied = await applyCataloguePricesToUnpricedPartLines(
      session.garageId,
      order.id,
      session.userId,
    );
    if (applied > 0) {
      const refreshed = await findServiceOrderById(session.garageId, orderId);
      if (refreshed) {
        return refreshed;
      }
    }
  }

  return order;
}

export async function getOrderTimeline(session: RoleSession, orderId: string) {
  const order = await getOrder(session, orderId);
  const events = await listServiceOrderAuditLogs(session.garageId, order.id);
  return events;
}

export async function getSuggestedJobCardNumber(session: RoleSession) {
  requireRole(session, [...CREATE_ROLES, "ACCOUNTANT"]);
  return getNextJobCardNumber(session.garageId);
}

export type SuggestedExpectedCompletion = {
  date: string;
  source: "inspection" | "estimate";
};

function toDateInputValue(value: Date | string | null): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Prefill Expected Completion from latest inspection, else latest estimate. */
export async function getSuggestedExpectedCompletionForVehicle(
  session: RoleSession,
  vehicleId: string,
): Promise<SuggestedExpectedCompletion | null> {
  requireRole(session, CREATE_ROLES);
  const vehicle = await findVehicleById(session.garageId, vehicleId);
  if (!vehicle) {
    throw new NotFoundError();
  }

  const inspection = await findLatestVehicleInspectionDue(
    session.garageId,
    vehicleId,
  );
  if (inspection?.expectedCompletion) {
    return {
      date: toDateInputValue(inspection.expectedCompletion),
      source: "inspection",
    };
  }

  const estimate = await findLatestCurrentEstimateForCustomerVehicle(
    session.garageId,
    vehicle.customerId,
    vehicleId,
  );
  const fromEstimate =
    estimate?.inspection?.expectedCompletion ??
    estimate?.serviceOrder?.expectedCompletion ??
    null;
  if (fromEstimate) {
    return {
      date: toDateInputValue(fromEstimate),
      source: "estimate",
    };
  }

  return null;
}

export async function updateNextJobCardNumberSetting(
  session: RoleSession,
  nextNumber: number,
) {
  requireRole(session, ["OWNER", "MANAGER"]);
  try {
    return await setNextJobCardNumberSeed(session.garageId, nextNumber);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "JOB_CARD_NUMBER_SEED_TOO_LOW"
    ) {
      throw new AppError("orders.job_card_number_seed_too_low", 400);
    }
    throw error;
  }
}

export async function createOrder(
  session: RoleSession,
  raw: CreateServiceOrderInput,
) {
  requireRole(session, CREATE_ROLES);
  const input = createServiceOrderSchema.parse(raw);

  const vehicle = await findVehicleById(session.garageId, input.vehicleId);
  if (!vehicle) {
    throw new NotFoundError();
  }

  const technicianIds =
    session.role === "TECHNICIAN"
      ? [session.userId]
      : input.technicianIds;

  for (const technicianId of technicianIds) {
    const technician = await findTechnicianInGarage(
      session.garageId,
      technicianId,
    );
    if (!technician) {
      throw new AppError("INVALID_TECHNICIAN", 400);
    }
  }

  let expectedCompletion = input.expectedCompletion;
  if (input.inspectionId) {
    const inspection = await findInspectionById(
      session.garageId,
      input.inspectionId,
    );
    if (!inspection) {
      throw new NotFoundError();
    }
    if (inspection.serviceOrderId) {
      throw new AppError("inspections.already_linked", 400);
    }
    if (
      inspection.customerId !== vehicle.customerId ||
      inspection.vehicleId !== vehicle.id
    ) {
      throw new AppError("inspections.link_mismatch", 400);
    }
    if (expectedCompletion == null && inspection.expectedCompletion) {
      expectedCompletion = inspection.expectedCompletion;
    }
  }

  let order;
  try {
    order = await createServiceOrder(session.garageId, {
      vehicleId: vehicle.id,
      customerId: vehicle.customerId,
      jobCardNumber: input.jobCardNumber,
      complaint: input.complaint,
      requestedServices: input.requestedServices,
      odometerIn: input.odometerIn,
      expectedCompletion,
      technicianIds,
      bay: input.bay,
      priority: input.priority,
      status: input.status,
      actorId: session.userId,
    });
  } catch (error) {
    if (error instanceof JobCardNumberConflictError) {
      throw new AppError("orders.job_card_number_exists", 409);
    }
    throw error;
  }

  if (input.inspectionId) {
    const linked = await linkInspectionToServiceOrder(
      session.garageId,
      input.inspectionId,
      {
        serviceOrderId: order.id,
        actorId: session.userId,
      },
    );
    if (!linked) {
      throw new AppError("inspections.link_failed", 400);
    }
  }

  return order;
}

export async function updateOrder(
  session: RoleSession,
  orderId: string,
  raw: UpdateServiceOrderInput,
) {
  requireRole(session, [...MANAGE_ROLES, "TECHNICIAN"]);
  const input = updateServiceOrderSchema.parse(raw);

  const order = await findServiceOrderById(session.garageId, orderId);
  if (!order) {
    throw new NotFoundError();
  }

  assertCanMutateOrder(session, order);

  const technicianIds =
    session.role === "TECHNICIAN"
      ? technicianIdsFromOrder(order)
      : input.technicianIds;

  for (const technicianId of technicianIds) {
    const technician = await findTechnicianInGarage(
      session.garageId,
      technicianId,
    );
    if (!technician) {
      throw new AppError("INVALID_TECHNICIAN", 400);
    }
  }

  let updated;
  try {
    updated = await updateServiceOrderDetails(session.garageId, orderId, {
      jobCardNumber: input.jobCardNumber,
      complaint: input.complaint,
      requestedServices: input.requestedServices,
      odometerIn: input.odometerIn,
      expectedCompletion: input.expectedCompletion,
      technicianIds,
      bay: input.bay,
      priority: input.priority,
      vehicleId: order.vehicleId,
      actorId: session.userId,
    });
  } catch (error) {
    if (error instanceof JobCardNumberConflictError) {
      throw new AppError("orders.job_card_number_exists", 409);
    }
    throw error;
  }

  if (!updated) {
    throw new NotFoundError();
  }

  if (input.status && input.status !== order.status) {
    if (!canTransitionStatus(order.status, input.status)) {
      throw new AppError("INVALID_STATUS_TRANSITION", 400);
    }
    const statusUpdated = await updateServiceOrderStatus(
      session.garageId,
      orderId,
      {
        from: order.status,
        to: input.status,
        actorId: session.userId,
      },
    );
    if (!statusUpdated) {
      throw new AppError("STATUS_CONFLICT", 409);
    }
    return statusUpdated;
  }

  return updated;
}

export async function changeOrderStatus(
  session: RoleSession,
  orderId: string,
  raw: UpdateServiceOrderStatusInput,
) {
  requireRole(session, [...MANAGE_ROLES, "TECHNICIAN"]);
  const input = updateServiceOrderStatusSchema.parse(raw);

  const order = await findServiceOrderById(session.garageId, orderId);
  if (!order) {
    throw new NotFoundError();
  }

  assertCanMutateOrder(session, order);

  if (!canTransitionStatus(order.status, input.status)) {
    throw new AppError("INVALID_STATUS_TRANSITION", 400);
  }

  const updated = await updateServiceOrderStatus(session.garageId, orderId, {
    from: order.status,
    to: input.status,
    actorId: session.userId,
  });

  if (!updated) {
    throw new AppError("STATUS_CONFLICT", 409);
  }

  return updated;
}

export async function addOrderLine(
  session: RoleSession,
  orderId: string,
  raw: AddServiceOrderLineInput,
) {
  requireRole(session, LINE_ROLES);
  const input = addServiceOrderLineSchema.parse(raw);

  const order = await findServiceOrderById(session.garageId, orderId);
  if (!order) {
    throw new NotFoundError();
  }

  assertCanMutateOrder(session, order);

  if (
    session.role === "TECHNICIAN" &&
    (input.type === "LABOUR" || input.type === "OUTSIDE")
  ) {
    throw new AppError("orders.technician_parts_only", 403);
  }

  if (input.type === "PART" && !input.partId) {
    throw new AppError("inventory.part_required", 400);
  }

  if (input.type === "OUTSIDE" && input.partId) {
    throw new AppError("validation.invalidInput", 400);
  }

  const unitPricePaise =
    session.role === "TECHNICIAN" ? 0 : input.unitPricePaise;
  const quantity =
    input.type === "LABOUR" || input.type === "OUTSIDE" ? 1 : input.quantity;

  const result = await createServiceOrderLine(session.garageId, {
    serviceOrderId: order.id,
    type: input.type,
    description: input.description,
    quantity,
    unitPricePaise,
    partId: input.type === "PART" ? input.partId : null,
    vendorId: input.type === "OUTSIDE" ? input.vendorId : null,
    gstSplit: input.type === "OUTSIDE" ? input.gstSplit : null,
    gstRatePercent: input.type === "OUTSIDE" ? input.gstRatePercent : null,
    actorId: session.userId,
  });

  if (!result.ok) {
    if (result.reason === "INSUFFICIENT_STOCK") {
      throw new AppError("inventory.insufficient_stock", 409, {
        partName: result.partName ?? "",
      });
    }
    if (result.reason === "VENDOR_NOT_FOUND") {
      throw new AppError("vendors.not_found", 404);
    }
    throw new NotFoundError();
  }

  return result.line;
}

export async function updateOrderLine(
  session: RoleSession,
  orderId: string,
  lineId: string,
  raw: UpdateServiceOrderLineInput,
) {
  requireRole(session, LINE_ROLES);
  const input = updateServiceOrderLineSchema.parse(raw);

  const order = await findServiceOrderById(session.garageId, orderId);
  if (!order) {
    throw new NotFoundError();
  }
  assertCanMutateOrder(session, order);

  const existing = order.lines.find((line) => line.id === lineId);
  if (!existing) {
    throw new NotFoundError();
  }
  if (
    session.role === "TECHNICIAN" &&
    (existing.type === "LABOUR" || existing.type === "OUTSIDE")
  ) {
    throw new AppError("orders.technician_parts_only", 403);
  }

  const unitPricePaise =
    session.role === "TECHNICIAN"
      ? (existing.unitPricePaise ?? 0)
      : input.unitPricePaise;
  const quantity =
    existing.type === "LABOUR" || existing.type === "OUTSIDE"
      ? 1
      : input.quantity;

  const clearBillRequested = Boolean(input.clearBill);
  const previousBillKey =
    existing.type === "OUTSIDE" &&
    existing.billStorageKey &&
    (clearBillRequested ||
      (input.gstRatePercent !== undefined && input.gstRatePercent <= 0))
      ? existing.billStorageKey
      : null;

  const result = await updateServiceOrderLine(session.garageId, {
    lineId,
    serviceOrderId: order.id,
    description: input.description,
    quantity,
    unitPricePaise,
    ...(existing.type === "PART"
      ? { partId: input.partId || existing.partId }
      : {}),
    ...(existing.type === "OUTSIDE"
      ? {
          vendorId: input.vendorId ?? existing.vendorId,
          gstSplit: input.gstSplit ?? existing.gstSplit,
          gstRatePercent:
            input.gstRatePercent ?? existing.gstRatePercent,
          clearBill: previousBillKey != null,
        }
      : {}),
    actorId: session.userId,
  });

  if (!result.ok) {
    if (result.reason === "INSUFFICIENT_STOCK") {
      throw new AppError("inventory.insufficient_stock", 409, {
        partName: result.partName ?? "",
      });
    }
    if (result.reason === "VENDOR_NOT_FOUND") {
      throw new AppError("vendors.not_found", 404);
    }
    throw new NotFoundError();
  }

  if (previousBillKey) {
    try {
      await deleteStoredObject(previousBillKey);
    } catch {}
  }

  return result.line;
}

export async function removeOrderLine(
  session: RoleSession,
  orderId: string,
  lineId: string,
) {
  requireRole(session, LINE_ROLES);

  const order = await findServiceOrderById(session.garageId, orderId);
  if (!order) {
    throw new NotFoundError();
  }
  assertCanMutateOrder(session, order);

  const existing = order.lines.find((line) => line.id === lineId);
  if (
    session.role === "TECHNICIAN" &&
    (existing?.type === "LABOUR" || existing?.type === "OUTSIDE")
  ) {
    throw new AppError("orders.technician_parts_only", 403);
  }

  const result = await deleteServiceOrderLine(session.garageId, {
    lineId,
    serviceOrderId: order.id,
    actorId: session.userId,
  });

  if (!result.ok) {
    if (result.reason === "BILLED_ON_FINALIZED_INVOICE") {
      throw new AppError("orders.line_on_finalized_invoice", 409);
    }
    throw new NotFoundError();
  }
}

export async function deleteOrder(session: RoleSession, orderId: string) {
  requireRole(session, MANAGE_ROLES);

  const order = await findServiceOrderById(session.garageId, orderId);
  if (!order) {
    throw new NotFoundError();
  }

  const paperCopies = await listPaperCopiesForOrder(session.garageId, orderId);

  const deleted = await deleteServiceOrderById(session.garageId, orderId, {
    actorId: session.userId,
    vehicleId: order.vehicleId,
    customerId: order.customerId,
    registrationNumber: order.vehicle.registrationNumber,
  });

  if (!deleted) {
    throw new NotFoundError();
  }

  for (const copy of paperCopies) {
    try {
      await deleteStoredObject(copy.storageKey);
    } catch {
      /* best-effort cleanup */
    }
  }

  return deleted;
}

export async function listPaperCopies(
  session: RoleSession,
  serviceOrderId: string,
) {
  requireRole(session, READ_ROLES);
  const order = await findServiceOrderById(session.garageId, serviceOrderId);
  if (!order) {
    throw new NotFoundError();
  }
  assertCanViewOrder(session, order);

  const rows = await listPaperCopiesForOrder(session.garageId, serviceOrderId);
  return Promise.all(
    rows.map(async (row) => {
      let url: string | null = null;
      try {
        url = await createPresignedDownloadUrl(row.storageKey);
      } catch {
        url = null;
      }
      return { ...row, url };
    }),
  );
}

export async function createPaperCopyUploadUrl(
  session: RoleSession,
  raw: CreatePaperCopyUploadUrlInput,
) {
  requireRole(session, MANAGE_ROLES);
  const input = createPaperCopyUploadUrlSchema.parse(raw);
  try {
    assertPaperCopyLimits(input.contentType, input.byteSize);
  } catch (error) {
    const code =
      error instanceof Error ? error.message : "orders.paper_copy_type";
    throw new AppError(code, 400);
  }

  const order = await findServiceOrderById(session.garageId, input.serviceOrderId);
  if (!order) {
    throw new NotFoundError();
  }

  if (input.replacePaperCopyId) {
    const existing = await listPaperCopiesForOrder(
      session.garageId,
      input.serviceOrderId,
    );
    if (!existing.some((row) => row.id === input.replacePaperCopyId)) {
      throw new NotFoundError();
    }
  } else {
    const count = await countPaperCopiesForOrder(
      session.garageId,
      input.serviceOrderId,
    );
    if (count >= MAX_PAPER_COPIES_PER_ORDER) {
      throw new AppError("orders.paper_copy_limit", 400);
    }
  }

  const storageKey = buildServiceOrderPaperCopyKey({
    garageId: session.garageId,
    serviceOrderId: order.id,
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
      contentType: input.contentType,
      serviceOrderId: order.id,
      replacePaperCopyId: input.replacePaperCopyId,
    };
  } catch (error) {
    if (error instanceof AppError && error.code === "STORAGE_NOT_CONFIGURED") {
      throw new AppError("STORAGE_NOT_CONFIGURED", 500);
    }
    throw error;
  }
}

export async function confirmPaperCopyUpload(
  session: RoleSession,
  raw: ConfirmPaperCopyInput,
) {
  requireRole(session, MANAGE_ROLES);
  const input = confirmPaperCopySchema.parse(raw);
  try {
    assertPaperCopyLimits(input.contentType, input.byteSize);
  } catch (error) {
    const code =
      error instanceof Error ? error.message : "orders.paper_copy_type";
    throw new AppError(code, 400);
  }

  if (!storageKeyBelongsToGarage(input.storageKey, session.garageId)) {
    throw new ForbiddenError();
  }
  if (
    !input.storageKey.includes(`/service-orders/${input.serviceOrderId}/paper/`)
  ) {
    throw new ForbiddenError();
  }

  const order = await findServiceOrderById(session.garageId, input.serviceOrderId);
  if (!order) {
    throw new NotFoundError();
  }

  const count = await countPaperCopiesForOrder(
    session.garageId,
    input.serviceOrderId,
  );
  if (count >= MAX_PAPER_COPIES_PER_ORDER) {
    throw new AppError("orders.paper_copy_limit", 400);
  }

  try {
    const row = await createPaperCopy(session.garageId, {
      serviceOrderId: input.serviceOrderId,
      storageKey: input.storageKey,
      contentType: input.contentType,
      fileName: input.fileName,
      byteSize: input.byteSize,
      actorId: session.userId,
    });
    let url: string | null = null;
    try {
      url = await createPresignedDownloadUrl(row.storageKey);
    } catch {
      url = null;
    }
    return { ...row, url };
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      throw new NotFoundError();
    }
    throw error;
  }
}

export async function removePaperCopyUpload(
  session: RoleSession,
  raw: RemovePaperCopyInput,
) {
  requireRole(session, MANAGE_ROLES);
  const input = removePaperCopySchema.parse(raw);

  const order = await findServiceOrderById(session.garageId, input.serviceOrderId);
  if (!order) {
    throw new NotFoundError();
  }

  const removed = await deletePaperCopy(session.garageId, {
    serviceOrderId: input.serviceOrderId,
    paperCopyId: input.paperCopyId,
    actorId: session.userId,
  });
  if (!removed) {
    throw new NotFoundError();
  }

  try {
    await deleteStoredObject(removed.storageKey);
  } catch {
    /* best-effort */
  }

  return removed;
}

export async function replacePaperCopyUpload(
  session: RoleSession,
  raw: ReplacePaperCopyInput,
) {
  requireRole(session, MANAGE_ROLES);
  const input = replacePaperCopySchema.parse(raw);
  try {
    assertPaperCopyLimits(input.contentType, input.byteSize);
  } catch (error) {
    const code =
      error instanceof Error ? error.message : "orders.paper_copy_type";
    throw new AppError(code, 400);
  }

  if (!storageKeyBelongsToGarage(input.storageKey, session.garageId)) {
    throw new ForbiddenError();
  }
  if (
    !input.storageKey.includes(`/service-orders/${input.serviceOrderId}/paper/`)
  ) {
    throw new ForbiddenError();
  }

  const order = await findServiceOrderById(session.garageId, input.serviceOrderId);
  if (!order) {
    throw new NotFoundError();
  }

  const replaced = await replacePaperCopy(session.garageId, {
    serviceOrderId: input.serviceOrderId,
    paperCopyId: input.paperCopyId,
    storageKey: input.storageKey,
    contentType: input.contentType,
    fileName: input.fileName,
    byteSize: input.byteSize,
    actorId: session.userId,
  });
  if (!replaced) {
    throw new NotFoundError();
  }

  if (replaced.previousStorageKey !== input.storageKey) {
    try {
      await deleteStoredObject(replaced.previousStorageKey);
    } catch {
      /* best-effort */
    }
  }

  let url: string | null = null;
  try {
    url = await createPresignedDownloadUrl(replaced.row.storageKey);
  } catch {
    url = null;
  }
  return { ...replaced.row, url };
}

export async function createOutsideWorkBillUploadUrl(
  session: RoleSession,
  raw: CreateOutsideWorkBillUploadUrlInput,
) {
  requireRole(session, LINE_ROLES);
  const input = createOutsideWorkBillUploadUrlSchema.parse(raw);
  try {
    assertOutsideWorkBillLimits(input.contentType, input.byteSize);
  } catch (error) {
    const code =
      error instanceof Error ? error.message : "orders.outside_work_bill_type";
    throw new AppError(code, 400);
  }

  const order = await findServiceOrderById(
    session.garageId,
    input.serviceOrderId,
  );
  if (!order) throw new NotFoundError();
  assertCanMutateOrder(session, order);

  const line = order.lines.find(
    (row) => row.id === input.lineId && row.type === "OUTSIDE",
  );
  if (!line) throw new NotFoundError();
  if ((line.gstRatePercent ?? 0) <= 0) {
    throw new AppError("orders.outside_work_bill_not_needed", 400);
  }

  const storageKey = buildOutsideWorkBillKey({
    garageId: session.garageId,
    serviceOrderId: order.id,
    lineId: line.id,
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
      contentType: input.contentType,
      serviceOrderId: order.id,
      lineId: line.id,
    };
  } catch (error) {
    if (error instanceof AppError && error.code === "STORAGE_NOT_CONFIGURED") {
      throw new AppError("STORAGE_NOT_CONFIGURED", 500);
    }
    throw error;
  }
}

export async function confirmOutsideWorkBill(
  session: RoleSession,
  raw: ConfirmOutsideWorkBillInput,
) {
  requireRole(session, LINE_ROLES);
  const input = confirmOutsideWorkBillSchema.parse(raw);
  try {
    assertOutsideWorkBillLimits(input.contentType, input.byteSize);
  } catch (error) {
    const code =
      error instanceof Error ? error.message : "orders.outside_work_bill_type";
    throw new AppError(code, 400);
  }

  if (!storageKeyBelongsToGarage(input.storageKey, session.garageId)) {
    throw new ForbiddenError();
  }
  if (
    !input.storageKey.includes(
      `/service-orders/${input.serviceOrderId}/outside-work/${input.lineId}/`,
    )
  ) {
    throw new ForbiddenError();
  }

  const order = await findServiceOrderById(
    session.garageId,
    input.serviceOrderId,
  );
  if (!order) throw new NotFoundError();
  assertCanMutateOrder(session, order);

  const line = order.lines.find(
    (row) => row.id === input.lineId && row.type === "OUTSIDE",
  );
  if (!line) throw new NotFoundError();
  if ((line.gstRatePercent ?? 0) <= 0) {
    throw new AppError("orders.outside_work_bill_not_needed", 400);
  }

  const result = await setOutsideWorkBill(session.garageId, {
    serviceOrderId: input.serviceOrderId,
    lineId: input.lineId,
    storageKey: input.storageKey,
    contentType: input.contentType,
    fileName: input.fileName,
    byteSize: input.byteSize,
    actorId: session.userId,
  });
  if (!result) throw new NotFoundError();

  if (
    result.previousStorageKey &&
    result.previousStorageKey !== input.storageKey
  ) {
    try {
      await deleteStoredObject(result.previousStorageKey);
    } catch {}
  }

  return result.line;
}

export async function getOutsideWorkBillDownloadUrl(
  session: RoleSession,
  serviceOrderId: string,
  lineId: string,
) {
  requireRole(session, LINE_ROLES);
  const order = await findServiceOrderById(session.garageId, serviceOrderId);
  if (!order) throw new NotFoundError();
  const line = order.lines.find(
    (row) => row.id === lineId && row.type === "OUTSIDE",
  );
  if (!line?.billStorageKey) throw new NotFoundError();
  return createPresignedDownloadUrl(line.billStorageKey);
}

/** Test helper: attempt to read while scoped to another garage id. */
export async function getOrderForGarageId(
  session: RoleSession,
  requestedGarageId: string,
  orderId: string,
) {
  if (requestedGarageId !== session.garageId) {
    throw new ForbiddenError();
  }
  return getOrder(session, orderId);
}

/** Test helper: attempt to change status while scoped to another garage id. */
export async function changeOrderStatusForGarageId(
  session: RoleSession,
  requestedGarageId: string,
  orderId: string,
  raw: UpdateServiceOrderStatusInput,
) {
  if (requestedGarageId !== session.garageId) {
    throw new ForbiddenError();
  }
  return changeOrderStatus(session, orderId, raw);
}

import "server-only";

import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { requireRole, type RoleSession } from "@/lib/rbac";
import { findServiceOrderById } from "@/modules/service-orders/repo";
import type { ServiceOrderStatusValue } from "@/modules/service-orders/schema";
import {
  addEstimateLineSchema,
  createEstimateRevisionSchema,
  createEstimateSchema,
  DEFAULT_GST_RATE_PERCENT,
  defaultHsnOrSac,
  setLineApprovalSchema,
  updatePermissionLineSchema,
  type AddEstimateLineInput,
  type CreateEstimateInput,
  type CreateEstimateRevisionInput,
  type EstimateLineTypeValue,
  type SetLineApprovalInput,
  type UpdatePermissionLineInput,
} from "@/modules/estimates/schema";
import {
  addEstimateLine,
  createEstimateWithLines,
  deleteEstimateLine,
  EstimateStockTxError,
  findCurrentEstimate,
  findEstimateById,
  findEstimateLineById,
  listEstimatesForOrder,
  recordLineApproval,
  updateEstimateLineDetails,
  type EstimateLineCreateInput,
} from "@/modules/estimates/repo";
import { computeEstimateTotals } from "@/modules/estimates/totals";

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
  order: { technicianId: string | null; status: ServiceOrderStatusValue },
) {
  if (session.role === "ACCOUNTANT") {
    throw new ForbiddenError();
  }
  if (session.role === "TECHNICIAN" && order.technicianId !== session.userId) {
    throw new ForbiddenError();
  }
  if (order.status === "COMPLETED") {
    throw new AppError("ORDER_COMPLETED");
  }
}

async function loadOrderForSession(session: RoleSession, orderId: string) {
  const order = await findServiceOrderById(session.garageId, orderId);
  if (!order) {
    throw new NotFoundError();
  }
  return order;
}

type SourceLine = {
  type: EstimateLineTypeValue;
  description: string;
  quantity: number;
  unitPricePaise: number;
  sourceOrderLineId?: string | null;
  sourceSuggestedRepairId?: string | null;
};

async function collectSourceLines(
  garageId: string,
  serviceOrderId: string,
): Promise<SourceLine[]> {
  const order = await findServiceOrderById(garageId, serviceOrderId);
  if (!order) {
    return [];
  }

  return order.lines.map((line) => ({
    type: line.type,
    description: line.description,
    quantity: line.quantity,
    unitPricePaise: line.unitPricePaise,
    sourceOrderLineId: line.id,
    sourceSuggestedRepairId: null,
  }));
}

function toCreateInput(
  sources: SourceLine[],
  startSort = 0,
  approvalState: "PENDING" | "APPROVED" = "PENDING",
): EstimateLineCreateInput[] {
  return sources.map((source, index) => ({
    type: source.type,
    description: source.description,
    quantity: source.quantity,
    unitPricePaise: source.unitPricePaise,
    gstRatePercent: DEFAULT_GST_RATE_PERCENT,
    hsnOrSac: defaultHsnOrSac(source.type),
    approvalState,
    sourceOrderLineId: source.sourceOrderLineId ?? null,
    sourceSuggestedRepairId: source.sourceSuggestedRepairId ?? null,
    sortOrder: startSort + index,
  }));
}

function withTotals<
  T extends {
    lines: Array<{
      quantity: number;
      unitPricePaise: number;
      gstRatePercent: number;
      approvalState: "PENDING" | "APPROVED" | "REJECTED";
    }>;
  },
>(estimate: T) {
  return {
    ...estimate,
    totals: computeEstimateTotals(estimate.lines),
  };
}

export async function getEstimateForOrder(
  session: RoleSession,
  serviceOrderId: string,
) {
  requireRole(session, READ_ROLES);
  const order = await loadOrderForSession(session, serviceOrderId);
  assertCanViewOrder(session, order);

  const current = await findCurrentEstimate(session.garageId, order.id);
  const revisions = await listEstimatesForOrder(session.garageId, order.id);

  return {
    order,
    current: current ? withTotals(current) : null,
    revisions,
  };
}

export async function getEstimateById(session: RoleSession, estimateId: string) {
  requireRole(session, READ_ROLES);
  const estimate = await findEstimateById(session.garageId, estimateId);
  if (!estimate) {
    throw new NotFoundError();
  }
  const order = await loadOrderForSession(session, estimate.serviceOrderId);
  assertCanViewOrder(session, order);
  return withTotals(estimate);
}

/** Build the first estimate from job-card labour and parts lines. */
export async function createEstimateFromSources(
  session: RoleSession,
  serviceOrderId: string,
  raw: CreateEstimateInput = {},
) {
  requireRole(session, WRITE_ROLES);
  const input = createEstimateSchema.parse(raw);
  const order = await loadOrderForSession(session, serviceOrderId);
  assertCanMutateOrder(session, order);

  const existing = await findCurrentEstimate(session.garageId, order.id);
  if (existing) {
    throw new AppError("ESTIMATE_EXISTS");
  }

  const sources = await collectSourceLines(session.garageId, order.id);
  if (sources.length === 0) {
    throw new AppError("ESTIMATE_NO_SOURCES");
  }

  if (sources.some((line) => line.unitPricePaise <= 0)) {
    throw new AppError("ESTIMATE_NO_PRICED_SOURCES");
  }

  const autoApprove = !input.askPermission;
  try {
    const estimate = await createEstimateWithLines(session.garageId, {
      serviceOrderId: order.id,
      revisionNumber: 1,
      notes: input.notes ?? null,
      askPermission: input.askPermission,
      permissionVia: input.permissionVia,
      createdById: session.userId,
      lines: toCreateInput(
        sources,
        0,
        autoApprove ? "APPROVED" : "PENDING",
      ),
      bootstrapApprovedLines: autoApprove,
    });
    if (!estimate) {
      throw new AppError("ESTIMATE_CREATE_FAILED");
    }
    return withTotals(estimate);
  } catch (error) {
    if (
      error instanceof EstimateStockTxError &&
      error.reason === "INSUFFICIENT_STOCK"
    ) {
      throw new AppError("inventory.insufficient_stock", 409);
    }
    throw error;
  }
}

/**
 * Create a revised estimate: keeps the previous revision and copies its lines
 * (including approval state). Add extra work on the new current estimate with Add.
 */
export async function createEstimateRevision(
  session: RoleSession,
  serviceOrderId: string,
  raw: CreateEstimateRevisionInput = {},
) {
  requireRole(session, WRITE_ROLES);
  const input = createEstimateRevisionSchema.parse(raw);
  const order = await loadOrderForSession(session, serviceOrderId);
  assertCanMutateOrder(session, order);

  const current = await findCurrentEstimate(session.garageId, order.id);
  if (!current) {
    throw new AppError("ESTIMATE_MISSING");
  }

  const copied: EstimateLineCreateInput[] = current.lines.map((line, index) => ({
    type: line.type,
    description: line.description,
    quantity: line.quantity,
    unitPricePaise: line.unitPricePaise,
    gstRatePercent: line.gstRatePercent,
    hsnOrSac: line.hsnOrSac,
    approvalState: line.approvalState,
    sourceOrderLineId: line.sourceOrderLineId,
    sourceSuggestedRepairId: line.sourceSuggestedRepairId,
    sortOrder: index,
  }));

  try {
    const estimate = await createEstimateWithLines(session.garageId, {
      serviceOrderId: order.id,
      revisionNumber: current.revisionNumber + 1,
      notes: input.notes ?? null,
      askPermission: current.askPermission,
      permissionVia: current.permissionVia,
      createdById: session.userId,
      lines: copied,
      supersedeEstimateId: current.id,
      bootstrapApprovedLines: false,
    });
    if (!estimate) {
      throw new AppError("ESTIMATE_REVISION_FAILED");
    }
    return withTotals(estimate);
  } catch (error) {
    if (
      error instanceof EstimateStockTxError &&
      error.reason === "INSUFFICIENT_STOCK"
    ) {
      throw new AppError("inventory.insufficient_stock", 409);
    }
    throw error;
  }
}

export async function addManualEstimateLine(
  session: RoleSession,
  serviceOrderId: string,
  raw: AddEstimateLineInput,
) {
  requireRole(session, WRITE_ROLES);
  const input = addEstimateLineSchema.parse(raw);
  const order = await loadOrderForSession(session, serviceOrderId);
  assertCanMutateOrder(session, order);

  const current = await findCurrentEstimate(session.garageId, order.id);
  if (!current) {
    throw new AppError("ESTIMATE_MISSING");
  }

  try {
    const line = await addEstimateLine(session.garageId, {
      estimateId: current.id,
      serviceOrderId: order.id,
      type: input.type,
      description: input.description,
      quantity: input.quantity,
      unitPricePaise: input.unitPricePaise,
      gstRatePercent: input.gstRatePercent,
      hsnOrSac: input.hsnOrSac,
      actorId: session.userId,
      autoApprove: !current.askPermission,
    });
    if (!line) {
      throw new AppError("ESTIMATE_LINE_FAILED");
    }
    return line;
  } catch (error) {
    if (
      error instanceof EstimateStockTxError &&
      error.reason === "INSUFFICIENT_STOCK"
    ) {
      throw new AppError("inventory.insufficient_stock", 409);
    }
    throw error;
  }
}

/**
 * Pull priced job-card lines that are not yet on the current estimate onto it.
 * Used before draft create / remake so later-added parts (e.g. battery) bill automatically.
 */
export async function syncMissingOrderLinesOntoEstimate(
  session: RoleSession,
  serviceOrderId: string,
  options?: { autoApprove?: boolean },
) {
  requireRole(session, [
    "OWNER",
    "MANAGER",
    "TECHNICIAN",
    "ACCOUNTANT",
  ] as const);
  const order = await loadOrderForSession(session, serviceOrderId);
  if (session.role === "ACCOUNTANT") {
    if (order.status === "COMPLETED") {
      throw new AppError("ORDER_COMPLETED");
    }
  } else {
    assertCanMutateOrder(session, order);
  }

  const current = await findCurrentEstimate(session.garageId, order.id);
  if (!current) {
    throw new AppError("ESTIMATE_MISSING");
  }

  const alreadyLinked = new Set(
    current.lines
      .map((line) => line.sourceOrderLineId)
      .filter((id): id is string => Boolean(id)),
  );

  const missing = order.lines.filter(
    (line) =>
      !alreadyLinked.has(line.id) &&
      line.unitPricePaise > 0,
  );

  const autoApprove = options?.autoApprove ?? !current.askPermission;
  const added = [];

  for (const line of missing) {
    try {
      const created = await addEstimateLine(session.garageId, {
        estimateId: current.id,
        serviceOrderId: order.id,
        type: line.type,
        description: line.description,
        quantity: line.quantity,
        unitPricePaise: line.unitPricePaise,
        gstRatePercent: DEFAULT_GST_RATE_PERCENT,
        hsnOrSac: defaultHsnOrSac(line.type),
        sourceOrderLineId: line.id,
        actorId: session.userId,
        autoApprove,
      });
      if (created) {
        added.push(created);
      }
    } catch (error) {
      if (
        error instanceof EstimateStockTxError &&
        error.reason === "INSUFFICIENT_STOCK"
      ) {
        throw new AppError("inventory.insufficient_stock", 409);
      }
      throw error;
    }
  }

  return { estimateId: current.id, addedCount: added.length };
}

export async function removeEstimateLine(
  session: RoleSession,
  lineId: string,
) {
  requireRole(session, WRITE_ROLES);

  const existing = await findEstimateLineById(session.garageId, lineId);
  if (!existing) {
    throw new NotFoundError();
  }
  if (existing.estimate.supersededAt != null) {
    throw new AppError("ESTIMATE_SUPERSEDED");
  }

  const order = await loadOrderForSession(
    session,
    existing.estimate.serviceOrderId,
  );
  assertCanMutateOrder(session, order);

  const result = await deleteEstimateLine(session.garageId, {
    lineId: existing.id,
    estimateId: existing.estimateId,
    serviceOrderId: order.id,
    description: existing.description,
    actorId: session.userId,
  });
  if (result === "not_found") {
    throw new NotFoundError();
  }
  if (result === "billed") {
    throw new AppError("ESTIMATE_LINE_BILLED");
  }
  if (result === "insufficient_stock") {
    throw new AppError("inventory.insufficient_stock", 409);
  }
}

export async function setEstimateLineApproval(
  session: RoleSession,
  lineId: string,
  raw: SetLineApprovalInput,
) {
  requireRole(session, WRITE_ROLES);
  const input = setLineApprovalSchema.parse(raw);

  const existing = await findEstimateLineById(session.garageId, lineId);
  if (!existing) {
    throw new NotFoundError();
  }
  if (existing.estimate.supersededAt != null) {
    throw new AppError("ESTIMATE_SUPERSEDED");
  }

  const order = await loadOrderForSession(
    session,
    existing.estimate.serviceOrderId,
  );
  assertCanMutateOrder(session, order);

  if (existing.approvalState === input.approvalState) {
    throw new AppError("APPROVAL_UNCHANGED");
  }

  const result = await recordLineApproval(session.garageId, {
    estimateId: existing.estimateId,
    estimateLineId: existing.id,
    serviceOrderId: order.id,
    fromState: existing.approvalState,
    toState: input.approvalState,
    method: input.method,
    note: input.note,
    recordedById: session.userId,
  });
  if (!result.ok) {
    if (result.reason === "INSUFFICIENT_STOCK") {
      throw new AppError("inventory.insufficient_stock", 409);
    }
    if (result.reason === "PART_NOT_FOUND") {
      throw new NotFoundError();
    }
    throw new AppError("APPROVAL_CONFLICT");
  }
  return result;
}

export async function savePermissionLine(
  session: RoleSession,
  lineId: string,
  raw: UpdatePermissionLineInput,
) {
  requireRole(session, WRITE_ROLES);
  const input = updatePermissionLineSchema.parse(raw);

  const existing = await findEstimateLineById(session.garageId, lineId);
  if (!existing) {
    throw new NotFoundError();
  }
  if (existing.estimate.supersededAt != null) {
    throw new AppError("ESTIMATE_SUPERSEDED");
  }

  const order = await loadOrderForSession(
    session,
    existing.estimate.serviceOrderId,
  );
  assertCanMutateOrder(session, order);

  const detailsChanged =
    existing.description !== input.description ||
    existing.quantity !== input.quantity ||
    existing.unitPricePaise !== input.unitPricePaise;
  const approvalChanged = existing.approvalState !== input.approvalState;

  if (!detailsChanged && !approvalChanged) {
    throw new AppError("APPROVAL_UNCHANGED");
  }

  if (detailsChanged) {
    try {
      const updated = await updateEstimateLineDetails(session.garageId, {
        lineId: existing.id,
        estimateId: existing.estimateId,
        serviceOrderId: order.id,
        description: input.description,
        quantity: input.quantity,
        unitPricePaise: input.unitPricePaise,
        actorId: session.userId,
      });
      if (updated === "billed") {
        throw new AppError("ESTIMATE_LINE_BILLED");
      }
      if (!updated) {
        throw new NotFoundError();
      }
    } catch (error) {
      if (
        error instanceof EstimateStockTxError &&
        error.reason === "INSUFFICIENT_STOCK"
      ) {
        throw new AppError("inventory.insufficient_stock", 409);
      }
      throw error;
    }
  }

  if (approvalChanged) {
    const result = await recordLineApproval(session.garageId, {
      estimateId: existing.estimateId,
      estimateLineId: existing.id,
      serviceOrderId: order.id,
      fromState: existing.approvalState,
      toState: input.approvalState,
      method: input.method,
      note: input.note,
      recordedById: session.userId,
    });
    if (!result.ok) {
      if (result.reason === "INSUFFICIENT_STOCK") {
        throw new AppError("inventory.insufficient_stock", 409);
      }
      if (result.reason === "PART_NOT_FOUND") {
        throw new NotFoundError();
      }
      throw new AppError("APPROVAL_CONFLICT");
    }
    return result;
  }

  return { line: existing };
}

/** Test helper: cross-garage read attempt. */
export async function getEstimateForGarageId(
  session: RoleSession,
  requestedGarageId: string,
  serviceOrderId: string,
) {
  if (requestedGarageId !== session.garageId) {
    throw new ForbiddenError();
  }
  return getEstimateForOrder(session, serviceOrderId);
}

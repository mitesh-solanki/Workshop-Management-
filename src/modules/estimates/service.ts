import "server-only";

import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { requireRole, type RoleSession } from "@/lib/rbac";
import { findInspectionByServiceOrderId } from "@/modules/inspections/repo";
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

  const fromOrder: SourceLine[] = order.lines.map((line) => ({
    type: line.type,
    description: line.description,
    quantity: line.quantity,
    unitPricePaise: line.unitPricePaise,
    sourceOrderLineId: line.id,
    sourceSuggestedRepairId: null,
  }));

  const inspection = await findInspectionByServiceOrderId(
    garageId,
    serviceOrderId,
  );
  const fromInspection: SourceLine[] = (inspection?.suggestedRepairs ?? []).map(
    (repair) => ({
      type: repair.type,
      description: repair.description,
      quantity: repair.quantity,
      unitPricePaise: repair.unitPricePaise,
      sourceOrderLineId: null,
      sourceSuggestedRepairId: repair.id,
    }),
  );

  return [...fromOrder, ...fromInspection];
}

function toCreateInput(
  sources: SourceLine[],
  startSort = 0,
): EstimateLineCreateInput[] {
  return sources.map((source, index) => ({
    type: source.type,
    description: source.description,
    quantity: source.quantity,
    unitPricePaise: source.unitPricePaise,
    gstRatePercent: DEFAULT_GST_RATE_PERCENT,
    hsnOrSac: defaultHsnOrSac(source.type),
    approvalState: "PENDING" as const,
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

/** Build the first estimate from order lines and inspection suggested repairs. */
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

  const estimate = await createEstimateWithLines(session.garageId, {
    serviceOrderId: order.id,
    revisionNumber: 1,
    notes: input.notes ?? null,
    createdById: session.userId,
    lines: toCreateInput(sources),
  });
  if (!estimate) {
    throw new AppError("ESTIMATE_CREATE_FAILED");
  }
  return withTotals(estimate);
}

/**
 * Create a revised estimate: keeps the previous revision, copies its lines
 * (including approval state), and optionally appends new order/inspection sources.
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

  let extra: EstimateLineCreateInput[] = [];
  if (input.includeNewSources) {
    const sources = await collectSourceLines(session.garageId, order.id);
    const knownOrderLineIds = new Set(
      copied
        .map((line) => line.sourceOrderLineId)
        .filter((id): id is string => Boolean(id)),
    );
    const knownRepairIds = new Set(
      copied
        .map((line) => line.sourceSuggestedRepairId)
        .filter((id): id is string => Boolean(id)),
    );
    const novel = sources.filter((source) => {
      if (
        source.sourceOrderLineId &&
        knownOrderLineIds.has(source.sourceOrderLineId)
      ) {
        return false;
      }
      if (
        source.sourceSuggestedRepairId &&
        knownRepairIds.has(source.sourceSuggestedRepairId)
      ) {
        return false;
      }
      return true;
    });
    extra = toCreateInput(novel, copied.length);
  }

  const estimate = await createEstimateWithLines(session.garageId, {
    serviceOrderId: order.id,
    revisionNumber: current.revisionNumber + 1,
    notes: input.notes ?? null,
    createdById: session.userId,
    lines: [...copied, ...extra],
    supersedeEstimateId: current.id,
  });
  if (!estimate) {
    throw new AppError("ESTIMATE_REVISION_FAILED");
  }
  return withTotals(estimate);
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
  });
  if (!line) {
    throw new AppError("ESTIMATE_LINE_FAILED");
  }
  return line;
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
  if (!result?.line) {
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
    const updated = await updateEstimateLineDetails(session.garageId, {
      lineId: existing.id,
      estimateId: existing.estimateId,
      serviceOrderId: order.id,
      description: input.description,
      quantity: input.quantity,
      unitPricePaise: input.unitPricePaise,
      actorId: session.userId,
    });
    if (!updated) {
      throw new NotFoundError();
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
    if (!result?.line) {
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

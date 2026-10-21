import "server-only";

import type {
  EstimateApprovalMethod,
  EstimateLineApprovalState,
  EstimateLineType,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db";

const approvalSelect = {
  id: true,
  garageId: true,
  estimateId: true,
  estimateLineId: true,
  fromState: true,
  toState: true,
  method: true,
  recordedById: true,
  note: true,
  createdAt: true,
  recordedBy: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
};

const lineSelect = {
  id: true,
  garageId: true,
  estimateId: true,
  type: true,
  description: true,
  quantity: true,
  unitPricePaise: true,
  gstRatePercent: true,
  hsnOrSac: true,
  approvalState: true,
  sourceOrderLineId: true,
  sourceSuggestedRepairId: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
};

const estimateSelect = {
  id: true,
  garageId: true,
  serviceOrderId: true,
  revisionNumber: true,
  notes: true,
  supersededAt: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  lines: {
    select: lineSelect,
    orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }],
  },
  approvals: {
    select: approvalSelect,
    orderBy: { createdAt: "desc" as const },
  },
};

export type EstimateLineCreateInput = {
  type: EstimateLineType;
  description: string;
  quantity: number;
  unitPricePaise: number;
  gstRatePercent: number;
  hsnOrSac: string;
  approvalState?: EstimateLineApprovalState;
  sourceOrderLineId?: string | null;
  sourceSuggestedRepairId?: string | null;
  sortOrder: number;
};

export async function findCurrentEstimate(
  garageId: string,
  serviceOrderId: string,
) {
  return prisma.estimate.findFirst({
    where: { garageId, serviceOrderId, supersededAt: null },
    select: estimateSelect,
  });
}

export async function listEstimatesForOrder(
  garageId: string,
  serviceOrderId: string,
) {
  return prisma.estimate.findMany({
    where: { garageId, serviceOrderId },
    select: {
      id: true,
      revisionNumber: true,
      notes: true,
      supersededAt: true,
      createdAt: true,
      createdBy: {
        select: { id: true, name: true, email: true },
      },
      _count: { select: { lines: true } },
    },
    orderBy: { revisionNumber: "desc" },
  });
}

export async function findEstimateById(garageId: string, estimateId: string) {
  return prisma.estimate.findFirst({
    where: { id: estimateId, garageId },
    select: estimateSelect,
  });
}

export async function findEstimateLineById(garageId: string, lineId: string) {
  return prisma.estimateLine.findFirst({
    where: { id: lineId, garageId },
    select: {
      ...lineSelect,
      estimate: {
        select: {
          id: true,
          serviceOrderId: true,
          supersededAt: true,
          revisionNumber: true,
        },
      },
    },
  });
}

export async function createEstimateWithLines(
  garageId: string,
  data: {
    serviceOrderId: string;
    revisionNumber: number;
    notes: string | null;
    createdById: string;
    lines: EstimateLineCreateInput[];
    /** When creating a revision, supersede this estimate id. */
    supersedeEstimateId?: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    if (data.supersedeEstimateId) {
      const superseded = await tx.estimate.updateMany({
        where: {
          id: data.supersedeEstimateId,
          garageId,
          supersededAt: null,
        },
        data: { supersededAt: new Date() },
      });
      if (superseded.count === 0) {
        return null;
      }
    }

    const estimate = await tx.estimate.create({
      data: {
        garageId,
        serviceOrderId: data.serviceOrderId,
        revisionNumber: data.revisionNumber,
        notes: data.notes,
        createdById: data.createdById,
        lines: {
          create: data.lines.map((line) => ({
            garageId,
            type: line.type,
            description: line.description,
            quantity: line.quantity,
            unitPricePaise: line.unitPricePaise,
            gstRatePercent: line.gstRatePercent,
            hsnOrSac: line.hsnOrSac,
            approvalState: line.approvalState ?? "PENDING",
            sourceOrderLineId: line.sourceOrderLineId ?? null,
            sourceSuggestedRepairId: line.sourceSuggestedRepairId ?? null,
            sortOrder: line.sortOrder,
          })),
        },
      },
      select: estimateSelect,
    });

    await tx.auditLog.create({
      data: {
        garageId,
        actorId: data.createdById,
        action: data.supersedeEstimateId
          ? "estimate.revision_created"
          : "estimate.created",
        entity: "Estimate",
        entityId: estimate.id,
        meta: {
          serviceOrderId: data.serviceOrderId,
          revisionNumber: data.revisionNumber,
          lineCount: data.lines.length,
          supersededEstimateId: data.supersedeEstimateId ?? null,
        } satisfies Prisma.InputJsonValue,
      },
    });

    return estimate;
  });
}

export async function addEstimateLine(
  garageId: string,
  data: {
    estimateId: string;
    serviceOrderId: string;
    type: EstimateLineType;
    description: string;
    quantity: number;
    unitPricePaise: number;
    gstRatePercent: number;
    hsnOrSac: string;
    actorId: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    const estimate = await tx.estimate.findFirst({
      where: {
        id: data.estimateId,
        garageId,
        supersededAt: null,
      },
      select: { id: true },
    });
    if (!estimate) {
      return null;
    }

    const maxSort = await tx.estimateLine.aggregate({
      where: { garageId, estimateId: data.estimateId },
      _max: { sortOrder: true },
    });
    const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;

    const line = await tx.estimateLine.create({
      data: {
        garageId,
        estimateId: data.estimateId,
        type: data.type,
        description: data.description,
        quantity: data.quantity,
        unitPricePaise: data.unitPricePaise,
        gstRatePercent: data.gstRatePercent,
        hsnOrSac: data.hsnOrSac,
        approvalState: "PENDING",
        sortOrder,
      },
      select: lineSelect,
    });

    await tx.auditLog.create({
      data: {
        garageId,
        actorId: data.actorId,
        action: "estimate.line_added",
        entity: "Estimate",
        entityId: data.estimateId,
        meta: {
          serviceOrderId: data.serviceOrderId,
          lineId: line.id,
          type: data.type,
          description: data.description,
          quantity: data.quantity,
          unitPricePaise: data.unitPricePaise,
          gstRatePercent: data.gstRatePercent,
          hsnOrSac: data.hsnOrSac,
        } satisfies Prisma.InputJsonValue,
      },
    });

    return line;
  });
}

export async function recordLineApproval(
  garageId: string,
  data: {
    estimateId: string;
    estimateLineId: string;
    serviceOrderId: string;
    fromState: EstimateLineApprovalState;
    toState: EstimateLineApprovalState;
    method: EstimateApprovalMethod;
    note: string | null;
    recordedById: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.estimateLine.updateMany({
      where: {
        id: data.estimateLineId,
        garageId,
        estimateId: data.estimateId,
        approvalState: data.fromState,
      },
      data: { approvalState: data.toState },
    });
    if (updated.count === 0) {
      return null;
    }

    const approval = await tx.estimateApproval.create({
      data: {
        garageId,
        estimateId: data.estimateId,
        estimateLineId: data.estimateLineId,
        fromState: data.fromState,
        toState: data.toState,
        method: data.method,
        recordedById: data.recordedById,
        note: data.note,
      },
      select: approvalSelect,
    });

    await tx.auditLog.create({
      data: {
        garageId,
        actorId: data.recordedById,
        action: "estimate.line_approval",
        entity: "Estimate",
        entityId: data.estimateId,
        meta: {
          serviceOrderId: data.serviceOrderId,
          lineId: data.estimateLineId,
          fromState: data.fromState,
          toState: data.toState,
          method: data.method,
          approvalId: approval.id,
        } satisfies Prisma.InputJsonValue,
      },
    });

    const line = await tx.estimateLine.findFirst({
      where: { id: data.estimateLineId, garageId },
      select: lineSelect,
    });

    return { line, approval };
  });
}

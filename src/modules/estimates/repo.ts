import "server-only";

import type {
  EstimateApprovalMethod,
  EstimateLineApprovalState,
  EstimateLineType,
  EstimatePermissionVia,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { applyStockMovement } from "@/modules/inventory/repo";

class EstimateStockTxError extends Error {
  readonly reason: "INSUFFICIENT_STOCK" | "PART_NOT_FOUND";
  readonly partName?: string;
  readonly partId?: string;

  constructor(
    reason: "INSUFFICIENT_STOCK" | "PART_NOT_FOUND",
    partName?: string,
    partId?: string,
  ) {
    super(reason);
    this.name = "EstimateStockTxError";
    this.reason = reason;
    this.partName = partName;
    this.partId = partId;
  }
}

/**
 * Linked job-card part for an estimate line, if any.
 * Manual / inspection-only lines have no inventory part to move.
 */
export async function findLinkedPartLine(
  tx: Prisma.TransactionClient,
  garageId: string,
  line: {
    type: EstimateLineType;
    sourceOrderLineId: string | null;
    sourceSuggestedRepairId: string | null;
  },
) {
  if (line.type !== "PART") {
    return null;
  }
  if (line.sourceOrderLineId) {
    const orderLine = await tx.serviceOrderLine.findFirst({
      where: { id: line.sourceOrderLineId, garageId, type: "PART" },
      select: { id: true, partId: true },
    });
    if (!orderLine?.partId) {
      return null;
    }
    return {
      partId: orderLine.partId,
      serviceOrderLineId: orderLine.id,
    };
  }
  if (line.sourceSuggestedRepairId) {
    const repair = await tx.suggestedRepair.findFirst({
      where: {
        id: line.sourceSuggestedRepairId,
        garageId,
        type: "PART",
      },
      select: { partId: true },
    });
    if (!repair?.partId) {
      return null;
    }
    return { partId: repair.partId, serviceOrderLineId: null };
  }
  return null;
}

export async function applyApprovedPartStock(
  tx: Prisma.TransactionClient,
  garageId: string,
  data: {
    partId: string;
    serviceOrderId: string;
    serviceOrderLineId: string | null;
    quantity: number;
    type: "IN" | "OUT";
    actorId: string | null;
    note: string;
  },
) {
  if (data.quantity <= 0) {
    return;
  }

  // serviceOrderLineId is unique on StockMovement — only attach it on the
  // first OUT for that job-card line. Later returns / re-issues stay unlinked.
  let serviceOrderLineId: string | null = null;
  if (data.type === "OUT" && data.serviceOrderLineId) {
    const linked = await tx.stockMovement.findFirst({
      where: { garageId, serviceOrderLineId: data.serviceOrderLineId },
      select: { id: true },
    });
    if (!linked) {
      serviceOrderLineId = data.serviceOrderLineId;
    }
  }

  const stock = await applyStockMovement(
    garageId,
    {
      partId: data.partId,
      type: data.type,
      quantity: data.quantity,
      note: data.note,
      actorId: data.actorId,
      serviceOrderId: data.serviceOrderId,
      serviceOrderLineId,
    },
    tx,
  );
  if (!stock.ok) {
    throw new EstimateStockTxError(
      stock.reason,
      stock.reason === "INSUFFICIENT_STOCK" ? stock.partName : undefined,
      stock.reason === "INSUFFICIENT_STOCK" ? stock.partId : undefined,
    );
  }
}

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
  inspectionId: true,
  revisionNumber: true,
  notes: true,
  askPermission: true,
  permissionVia: true,
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

export async function findCurrentEstimateForInspection(
  garageId: string,
  inspectionId: string,
) {
  return prisma.estimate.findFirst({
    where: { garageId, inspectionId, supersededAt: null },
    select: estimateSelect,
  });
}

/** Latest current estimate for this customer + vehicle (inspection or job card). */
export async function findLatestCurrentEstimateForCustomerVehicle(
  garageId: string,
  customerId: string,
  vehicleId: string,
) {
  return prisma.estimate.findFirst({
    where: {
      garageId,
      supersededAt: null,
      OR: [
        { inspection: { customerId, vehicleId } },
        { serviceOrder: { customerId, vehicleId } },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: {
      ...estimateSelect,
      inspection: {
        select: {
          id: true,
          expectedCompletion: true,
        },
      },
      serviceOrder: {
        select: {
          id: true,
          expectedCompletion: true,
        },
      },
    },
  });
}

const estimateRevisionListSelect = {
  id: true,
  revisionNumber: true,
  notes: true,
  supersededAt: true,
  createdAt: true,
  createdBy: {
    select: { id: true, name: true, email: true },
  },
  lines: {
    select: {
      id: true,
      type: true,
      description: true,
      quantity: true,
      unitPricePaise: true,
      approvalState: true,
      sortOrder: true,
    },
    orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }],
  },
  _count: { select: { lines: true } },
};

export async function listEstimatesForOrder(
  garageId: string,
  serviceOrderId: string,
) {
  return prisma.estimate.findMany({
    where: { garageId, serviceOrderId },
    select: estimateRevisionListSelect,
    orderBy: { revisionNumber: "desc" },
  });
}

export async function listEstimatesForInspection(
  garageId: string,
  inspectionId: string,
) {
  return prisma.estimate.findMany({
    where: { garageId, inspectionId },
    select: estimateRevisionListSelect,
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
          inspectionId: true,
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
    serviceOrderId?: string | null;
    inspectionId?: string | null;
    revisionNumber: number;
    notes: string | null;
    askPermission?: boolean;
    permissionVia?: EstimatePermissionVia | null;
    createdById: string;
    lines: EstimateLineCreateInput[];
    /** When creating a revision, supersede this estimate id. */
    supersedeEstimateId?: string;
    /**
     * Apply stock OUT + approval history for lines created as APPROVED.
     * Only for first create with askPermission=false — not revisions.
     * Stock is skipped for inspection-only estimates (no service order).
     */
    bootstrapApprovedLines?: boolean;
  },
) {
  const serviceOrderId = data.serviceOrderId?.trim() || null;
  const inspectionId = data.inspectionId?.trim() || null;
  if ((serviceOrderId == null) === (inspectionId == null)) {
    throw new Error("Estimate requires exactly one of serviceOrderId or inspectionId");
  }

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

    const askPermission = data.askPermission ?? false;
    const permissionVia = askPermission
      ? (data.permissionVia ?? null)
      : null;

    const estimate = await tx.estimate.create({
      data: {
        garageId,
        serviceOrderId,
        inspectionId,
        revisionNumber: data.revisionNumber,
        notes: data.notes,
        askPermission,
        permissionVia,
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

    if (data.bootstrapApprovedLines) {
      for (const line of estimate.lines) {
        if (line.approvalState !== "APPROVED") {
          continue;
        }

        if (serviceOrderId) {
          const linked = await findLinkedPartLine(tx, garageId, line);
          if (linked) {
            await applyApprovedPartStock(tx, garageId, {
              partId: linked.partId,
              serviceOrderId,
              serviceOrderLineId: linked.serviceOrderLineId,
              quantity: line.quantity,
              type: "OUT",
              actorId: data.createdById,
              note: `Estimate auto-approved ${serviceOrderId} (line ${line.id})`,
            });
          }
        }

        await tx.estimateApproval.create({
          data: {
            garageId,
            estimateId: estimate.id,
            estimateLineId: line.id,
            fromState: null,
            toState: "APPROVED",
            method: "MANUAL",
            recordedById: data.createdById,
            note: "Customer permission not required",
          },
        });
      }
    }

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
          serviceOrderId,
          inspectionId,
          revisionNumber: data.revisionNumber,
          lineCount: data.lines.length,
          askPermission,
          permissionVia,
          supersededEstimateId: data.supersedeEstimateId ?? null,
        } satisfies Prisma.InputJsonValue,
      },
    });

    return tx.estimate.findFirst({
      where: { id: estimate.id, garageId },
      select: estimateSelect,
    });
  });
}

export async function updateEstimateLineDetails(
  garageId: string,
  data: {
    lineId: string;
    estimateId: string;
    serviceOrderId: string | null;
    description: string;
    quantity: number;
    unitPricePaise: number;
    actorId: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.estimateLine.findFirst({
      where: {
        id: data.lineId,
        garageId,
        estimateId: data.estimateId,
      },
      select: lineSelect,
    });
    if (!existing) {
      return null;
    }

    // A finalized invoice is immutable, including the estimate details
    // from which its lines were issued. Draft invoice lines do not lock edits.
    const finalizedLineCount = await tx.invoiceLine.count({
      where: {
        garageId,
        estimateLineId: data.lineId,
        invoice: { status: "FINALIZED" },
      },
    });
    if (finalizedLineCount > 0) {
      return "billed" as const;
    }

    const quantityDelta = data.quantity - existing.quantity;
    if (
      data.serviceOrderId &&
      existing.approvalState === "APPROVED" &&
      quantityDelta !== 0
    ) {
      const linked = await findLinkedPartLine(tx, garageId, existing);
      if (linked) {
        await applyApprovedPartStock(tx, garageId, {
          partId: linked.partId,
          serviceOrderId: data.serviceOrderId,
          serviceOrderLineId: linked.serviceOrderLineId,
          quantity: Math.abs(quantityDelta),
          type: quantityDelta > 0 ? "OUT" : "IN",
          actorId: data.actorId,
          note: `Estimate line qty change ${data.serviceOrderId} (line ${existing.id})`,
        });
      }
    }

    const updated = await tx.estimateLine.updateMany({
      where: {
        id: data.lineId,
        garageId,
        estimateId: data.estimateId,
      },
      data: {
        description: data.description,
        quantity: data.quantity,
        unitPricePaise: data.unitPricePaise,
      },
    });
    if (updated.count === 0) {
      return null;
    }

    await tx.auditLog.create({
      data: {
        garageId,
        actorId: data.actorId,
        action: "estimate.line_updated",
        entity: "EstimateLine",
        entityId: data.lineId,
        meta: {
          serviceOrderId: data.serviceOrderId,
          estimateId: data.estimateId,
          description: data.description,
          quantity: data.quantity,
          unitPricePaise: data.unitPricePaise,
        } satisfies Prisma.InputJsonValue,
      },
    });

    return tx.estimateLine.findFirst({
      where: { id: data.lineId, garageId },
      select: lineSelect,
    });
  });
}

export async function addEstimateLine(
  garageId: string,
  data: {
    estimateId: string;
    serviceOrderId: string | null;
    type: EstimateLineType;
    description: string;
    quantity: number;
    unitPricePaise: number;
    gstRatePercent: number;
    hsnOrSac: string;
    actorId: string;
    sourceOrderLineId?: string | null;
    /** When true (no-permission estimate), create as APPROVED and move stock. */
    autoApprove?: boolean;
  },
) {
  return prisma.$transaction(async (tx) => {
    const estimate = await tx.estimate.findFirst({
      where: {
        id: data.estimateId,
        garageId,
        supersededAt: null,
      },
      select: { id: true, askPermission: true },
    });
    if (!estimate) {
      return null;
    }

    const maxSort = await tx.estimateLine.aggregate({
      where: { garageId, estimateId: data.estimateId },
      _max: { sortOrder: true },
    });
    const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;
    const autoApprove = data.autoApprove ?? !estimate.askPermission;
    const approvalState: EstimateLineApprovalState = autoApprove
      ? "APPROVED"
      : "PENDING";

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
        approvalState,
        sourceOrderLineId: data.sourceOrderLineId ?? null,
        sortOrder,
      },
      select: lineSelect,
    });

    if (autoApprove) {
      if (data.serviceOrderId) {
        const linked = await findLinkedPartLine(tx, garageId, line);
        if (linked) {
          await applyApprovedPartStock(tx, garageId, {
            partId: linked.partId,
            serviceOrderId: data.serviceOrderId,
            serviceOrderLineId: linked.serviceOrderLineId,
            quantity: line.quantity,
            type: "OUT",
            actorId: data.actorId,
            note: `Estimate auto-approved ${data.serviceOrderId} (line ${line.id})`,
          });
        }
      }
      await tx.estimateApproval.create({
        data: {
          garageId,
          estimateId: data.estimateId,
          estimateLineId: line.id,
          fromState: null,
          toState: "APPROVED",
          method: "MANUAL",
          recordedById: data.actorId,
          note: "Customer permission not required",
        },
      });
    }

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
          approvalState,
        } satisfies Prisma.InputJsonValue,
      },
    });

    return line;
  });
}

export async function removeDraftInvoiceLinesForEstimateLine(
  tx: Prisma.TransactionClient,
  garageId: string,
  estimateLineId: string,
) {
  const draftLines = await tx.invoiceLine.findMany({
    where: {
      garageId,
      estimateLineId,
      invoice: { status: "DRAFT" },
    },
    select: { id: true, invoiceId: true },
  });
  if (draftLines.length === 0) {
    return;
  }

  const invoiceIds = [...new Set(draftLines.map((line) => line.invoiceId))];
  await tx.invoiceLine.deleteMany({
    where: {
      id: { in: draftLines.map((line) => line.id) },
      garageId,
    },
  });

  for (const invoiceId of invoiceIds) {
    const remaining = await tx.invoiceLine.findMany({
      where: { invoiceId, garageId },
      select: {
        taxablePaise: true,
        cgstPaise: true,
        sgstPaise: true,
        igstPaise: true,
        totalPaise: true,
      },
    });
    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        taxablePaise: remaining.reduce((sum, line) => sum + line.taxablePaise, 0),
        cgstPaise: remaining.reduce((sum, line) => sum + line.cgstPaise, 0),
        sgstPaise: remaining.reduce((sum, line) => sum + line.sgstPaise, 0),
        igstPaise: remaining.reduce((sum, line) => sum + line.igstPaise, 0),
        totalPaise: remaining.reduce((sum, line) => sum + line.totalPaise, 0),
      },
    });
  }
}

export async function deleteEstimateLine(
  garageId: string,
  data: {
    lineId: string;
    estimateId: string;
    serviceOrderId: string | null;
    description: string;
    actorId: string;
  },
): Promise<"ok" | "not_found" | "billed"> {
  return prisma.$transaction(async (tx) => {
      // Draft invoices are editable snapshots. Only finalized invoice lines
      // lock their source estimate lines against deletion.
      const billed = await tx.invoiceLine.count({
        where: {
          garageId,
          estimateLineId: data.lineId,
          invoice: { status: "FINALIZED" },
        },
      });
      if (billed > 0) {
        return "billed";
      }

      const existing = await tx.estimateLine.findFirst({
        where: {
          id: data.lineId,
          garageId,
          estimateId: data.estimateId,
        },
        select: lineSelect,
      });
      if (!existing) {
        return "not_found";
      }

      if (existing.approvalState === "APPROVED" && data.serviceOrderId) {
        const linked = await findLinkedPartLine(tx, garageId, existing);
        if (linked) {
          await applyApprovedPartStock(tx, garageId, {
            partId: linked.partId,
            serviceOrderId: data.serviceOrderId,
            serviceOrderLineId: linked.serviceOrderLineId,
            quantity: existing.quantity,
            type: "IN",
            actorId: data.actorId,
            note: `Estimate line removed ${data.serviceOrderId} (line ${existing.id})`,
          });
        }
      }

      await removeDraftInvoiceLinesForEstimateLine(tx, garageId, existing.id);

      const removed = await tx.estimateLine.deleteMany({
        where: {
          id: data.lineId,
          garageId,
          estimateId: data.estimateId,
        },
      });
      if (removed.count === 0) {
        return "not_found";
      }

      await tx.auditLog.create({
        data: {
          garageId,
          actorId: data.actorId,
          action: "estimate.line_removed",
          entity: "EstimateLine",
          entityId: data.lineId,
          meta: {
            serviceOrderId: data.serviceOrderId,
            estimateId: data.estimateId,
            description: data.description,
          } satisfies Prisma.InputJsonValue,
        },
      });

      return "ok";
  });
}

export type RecordLineApprovalResult =
  | {
      ok: true;
      line: {
        id: string;
        garageId: string;
        estimateId: string;
        type: EstimateLineType;
        description: string;
        quantity: number;
        unitPricePaise: number;
        gstRatePercent: number;
        hsnOrSac: string;
        approvalState: EstimateLineApprovalState;
        sourceOrderLineId: string | null;
        sourceSuggestedRepairId: string | null;
        sortOrder: number;
        createdAt: Date;
        updatedAt: Date;
      };
      approval: {
        id: string;
        garageId: string;
        estimateId: string;
        estimateLineId: string;
        fromState: EstimateLineApprovalState | null;
        toState: EstimateLineApprovalState;
        method: EstimateApprovalMethod;
        recordedById: string | null;
        note: string | null;
        createdAt: Date;
        recordedBy: {
          id: string;
          name: string | null;
          email: string;
        } | null;
      };
    }
  | {
      ok: false;
      reason: "CONFLICT" | "INSUFFICIENT_STOCK" | "PART_NOT_FOUND";
      partName?: string;
      partId?: string;
    };

export async function recordLineApproval(
  garageId: string,
  data: {
    estimateId: string;
    estimateLineId: string;
    serviceOrderId: string | null;
    fromState: EstimateLineApprovalState;
    toState: EstimateLineApprovalState;
    method: EstimateApprovalMethod;
    note: string | null;
    recordedById: string;
  },
): Promise<RecordLineApprovalResult> {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.estimateLine.findFirst({
        where: {
          id: data.estimateLineId,
          garageId,
          estimateId: data.estimateId,
          approvalState: data.fromState,
        },
        select: lineSelect,
      });
      if (!existing) {
        return { ok: false as const, reason: "CONFLICT" as const };
      }

      const linked = data.serviceOrderId
        ? await findLinkedPartLine(tx, garageId, existing)
        : null;
      if (linked && data.serviceOrderId) {
        if (data.fromState !== "APPROVED" && data.toState === "APPROVED") {
          await applyApprovedPartStock(tx, garageId, {
            partId: linked.partId,
            serviceOrderId: data.serviceOrderId,
            serviceOrderLineId: linked.serviceOrderLineId,
            quantity: existing.quantity,
            type: "OUT",
            actorId: data.recordedById,
            note: `Estimate approved ${data.serviceOrderId} (line ${existing.id})`,
          });
        } else if (data.fromState === "APPROVED" && data.toState !== "APPROVED") {
          await applyApprovedPartStock(tx, garageId, {
            partId: linked.partId,
            serviceOrderId: data.serviceOrderId,
            serviceOrderLineId: linked.serviceOrderLineId,
            quantity: existing.quantity,
            type: "IN",
            actorId: data.recordedById,
            note: `Estimate unapproved ${data.serviceOrderId} (line ${existing.id})`,
          });
        }
      }

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
        return { ok: false as const, reason: "CONFLICT" as const };
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
      if (!line) {
        return { ok: false as const, reason: "CONFLICT" as const };
      }

      return { ok: true as const, line, approval };
    });

    return result;
  } catch (error) {
    if (error instanceof EstimateStockTxError) {
      return {
        ok: false,
        reason: error.reason,
        partName: error.partName,
        partId: error.partId,
      };
    }
    throw error;
  }
}

export { EstimateStockTxError };

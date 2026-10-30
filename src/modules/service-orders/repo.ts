import "server-only";

import type {
  Prisma,
  ServiceOrderLineType,
  ServiceOrderPriority,
  ServiceOrderStatus,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  applyApprovedPartStock,
  EstimateStockTxError,
  findLinkedPartLine,
  removeDraftInvoiceLinesForEstimateLine,
} from "@/modules/estimates/repo";
import { applyStockMovement } from "@/modules/inventory/repo";
import {
  SERVICE_ORDER_STATUSES,
  type ServiceOrderStatusValue,
} from "@/modules/service-orders/schema";

function emptyStatusCounts(): Record<ServiceOrderStatusValue, number> {
  return Object.fromEntries(
    SERVICE_ORDER_STATUSES.map((status) => [status, 0]),
  ) as Record<ServiceOrderStatusValue, number>;
}

/** Match legacy primary technicianId or any join-table assignment. */
export function assignedTechnicianWhere(
  technicianId: string,
): Prisma.ServiceOrderWhereInput {
  return {
    OR: [
      { technicianId },
      { technicianAssignments: { some: { technicianId } } },
    ],
  };
}

function serviceOrderScopeWhere(
  garageId: string,
  options: { technicianId?: string } = {},
): Prisma.ServiceOrderWhereInput {
  if (!options.technicianId) {
    return { garageId };
  }
  return {
    garageId,
    AND: [assignedTechnicianWhere(options.technicianId)],
  };
}

const technicianAssignmentSelect = {
  technicianId: true,
  technician: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} as const;

const lineSelect = {
  id: true,
  garageId: true,
  serviceOrderId: true,
  type: true,
  description: true,
  quantity: true,
  unitPricePaise: true,
  partId: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} as const;

const orderListSelect = {
  id: true,
  garageId: true,
  vehicleId: true,
  customerId: true,
  status: true,
  priority: true,
  complaint: true,
  requestedServices: true,
  odometerIn: true,
  expectedCompletion: true,
  technicianId: true,
  bay: true,
  createdAt: true,
  updatedAt: true,
  vehicle: {
    select: {
      id: true,
      registrationNumber: true,
      make: true,
      model: true,
      stateCode: true,
    },
  },
  customer: {
    select: {
      id: true,
      name: true,
      phone: true,
    },
  },
  technician: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  technicianAssignments: {
    select: technicianAssignmentSelect,
    orderBy: { createdAt: "asc" as const },
  },
  lines: {
    where: {
      type: "PART" as const,
      unitPricePaise: 0,
      OR: [{ partId: null }, { part: { sellingPricePaise: { lte: 0 } } }],
    },
    select: { id: true },
    take: 1,
  },
} satisfies Prisma.ServiceOrderSelect;

export async function listTechniciansInGarage(garageId: string) {
  return prisma.user.findMany({
    where: { garageId, role: "TECHNICIAN" },
    select: {
      id: true,
      name: true,
      email: true,
    },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });
}

export async function findTechnicianInGarage(
  garageId: string,
  userId: string,
) {
  return prisma.user.findFirst({
    where: { id: userId, garageId, role: "TECHNICIAN" },
    select: { id: true, name: true, email: true, role: true },
  });
}

export async function listServiceOrders(
  garageId: string,
  options: { technicianId?: string; bay?: string } = {},
) {
  return prisma.serviceOrder.findMany({
    where: {
      ...serviceOrderScopeWhere(garageId, {
        technicianId: options.technicianId,
      }),
      ...(options.bay ? { bay: options.bay } : {}),
    },
    select: orderListSelect,
    orderBy: [{ createdAt: "desc" }],
    take: 200,
  });
}

export async function countServiceOrdersByStatus(
  garageId: string,
  options: { technicianId?: string } = {},
): Promise<Record<ServiceOrderStatusValue, number>> {
  const groups = await prisma.serviceOrder.groupBy({
    by: ["status"],
    where: serviceOrderScopeWhere(garageId, options),
    _count: { _all: true },
  });

  const counts = emptyStatusCounts();
  for (const row of groups) {
    counts[row.status] = row._count._all;
  }
  return counts;
}

export async function countOverdueServiceOrders(
  garageId: string,
  options: { technicianId?: string } = {},
): Promise<number> {
  return prisma.serviceOrder.count({
    where: {
      ...serviceOrderScopeWhere(garageId, options),
      status: { not: "COMPLETED" },
      expectedCompletion: { lt: new Date() },
    },
  });
}

/**
 * Open jobs for the home “today” list: due today or opened today
 * (bounds are UTC instants for the workshop calendar day).
 */
export async function listServiceOrdersForToday(
  garageId: string,
  day: { start: Date; end: Date },
  options: { technicianId?: string } = {},
) {
  return prisma.serviceOrder.findMany({
    where: {
      garageId,
      status: { not: "COMPLETED" },
      AND: [
        ...(options.technicianId
          ? [assignedTechnicianWhere(options.technicianId)]
          : []),
        {
          OR: [
            {
              expectedCompletion: {
                gte: day.start,
                lt: day.end,
              },
            },
            {
              createdAt: {
                gte: day.start,
                lt: day.end,
              },
            },
          ],
        },
      ],
    },
    select: orderListSelect,
    orderBy: [
      { expectedCompletion: "asc" },
      { createdAt: "desc" },
    ],
    take: 25,
  });
}

const historySelect = {
  id: true,
  status: true,
  complaint: true,
  createdAt: true,
  expectedCompletion: true,
  vehicle: {
    select: {
      id: true,
      registrationNumber: true,
    },
  },
} as const;

export async function listServiceOrdersByCustomer(
  garageId: string,
  customerId: string,
) {
  return prisma.serviceOrder.findMany({
    where: { garageId, customerId },
    select: historySelect,
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function listServiceOrdersByVehicle(
  garageId: string,
  vehicleId: string,
) {
  return prisma.serviceOrder.findMany({
    where: { garageId, vehicleId },
    select: historySelect,
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function findServiceOrderById(
  garageId: string,
  orderId: string,
) {
  return prisma.serviceOrder.findFirst({
    where: { id: orderId, garageId },
    select: {
      ...orderListSelect,
      lines: {
        select: {
          ...lineSelect,
          part: { select: { sellingPricePaise: true } },
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });
}

/** Fill ₹0 part lines from catalogue selling price when inventory already has one. */
export async function applyCataloguePricesToUnpricedPartLines(
  garageId: string,
  serviceOrderId: string,
  actorId: string,
): Promise<number> {
  const lines = await prisma.serviceOrderLine.findMany({
    where: {
      garageId,
      serviceOrderId,
      type: "PART",
      unitPricePaise: 0,
      partId: { not: null },
    },
    select: {
      id: true,
      part: { select: { sellingPricePaise: true } },
    },
  });

  const toUpdate = lines.filter(
    (line) => (line.part?.sellingPricePaise ?? 0) > 0,
  );
  if (toUpdate.length === 0) {
    return 0;
  }

  await prisma.$transaction(async (tx) => {
    for (const line of toUpdate) {
      await tx.serviceOrderLine.update({
        where: { id: line.id },
        data: { unitPricePaise: line.part!.sellingPricePaise },
      });
    }
    await tx.auditLog.create({
      data: {
        garageId,
        actorId,
        action: "service_order.catalogue_prices_applied",
        entity: "ServiceOrder",
        entityId: serviceOrderId,
        meta: {
          lineIds: toUpdate.map((line) => line.id),
          count: toUpdate.length,
        } satisfies Prisma.InputJsonValue,
      },
    });
  });

  return toUpdate.length;
}

export async function createServiceOrder(
  garageId: string,
  data: {
    vehicleId: string;
    customerId: string;
    complaint: string;
    requestedServices: string | null;
    odometerIn: number | null;
    expectedCompletion: Date | null;
    technicianIds: string[];
    bay: string | null;
    priority: ServiceOrderPriority;
    actorId: string;
  },
) {
  const technicianIds = [...new Set(data.technicianIds.filter(Boolean))];
  const primaryTechnicianId = technicianIds[0] ?? null;

  return prisma.$transaction(async (tx) => {
    const order = await tx.serviceOrder.create({
      data: {
        garageId,
        vehicleId: data.vehicleId,
        customerId: data.customerId,
        status: "WAITING",
        priority: data.priority,
        complaint: data.complaint,
        requestedServices: data.requestedServices,
        odometerIn: data.odometerIn,
        expectedCompletion: data.expectedCompletion,
        technicianId: primaryTechnicianId,
        bay: data.bay,
        technicianAssignments: {
          create: technicianIds.map((technicianId) => ({
            garageId,
            technicianId,
          })),
        },
      },
      select: orderListSelect,
    });

    if (data.odometerIn != null) {
      await tx.vehicle.updateMany({
        where: { id: data.vehicleId, garageId },
        data: { odometer: data.odometerIn },
      });
    }

    await tx.auditLog.create({
      data: {
        garageId,
        actorId: data.actorId,
        action: "service_order.status_changed",
        entity: "ServiceOrder",
        entityId: order.id,
        meta: {
          from: null,
          to: "WAITING",
          created: true,
          technicianIds,
        } satisfies Prisma.InputJsonValue,
      },
    });

    return order;
  });
}

export async function updateServiceOrderDetails(
  garageId: string,
  orderId: string,
  data: {
    complaint: string;
    requestedServices: string | null;
    odometerIn: number | null;
    expectedCompletion: Date | null;
    technicianIds: string[];
    bay: string | null;
    priority: ServiceOrderPriority;
    vehicleId: string;
    actorId: string;
  },
) {
  const technicianIds = [...new Set(data.technicianIds.filter(Boolean))];
  const primaryTechnicianId = technicianIds[0] ?? null;

  return prisma.$transaction(async (tx) => {
    const existing = await tx.serviceOrder.findFirst({
      where: { id: orderId, garageId },
      select: { id: true },
    });
    if (!existing) {
      return null;
    }

    await tx.serviceOrderTechnicianAssignment.deleteMany({
      where: { serviceOrderId: orderId, garageId },
    });

    if (technicianIds.length > 0) {
      await tx.serviceOrderTechnicianAssignment.createMany({
        data: technicianIds.map((technicianId) => ({
          garageId,
          serviceOrderId: orderId,
          technicianId,
        })),
      });
    }

    const order = await tx.serviceOrder.update({
      where: { id: orderId },
      data: {
        complaint: data.complaint,
        requestedServices: data.requestedServices,
        odometerIn: data.odometerIn,
        expectedCompletion: data.expectedCompletion,
        technicianId: primaryTechnicianId,
        bay: data.bay,
        priority: data.priority,
      },
      select: orderListSelect,
    });

    if (data.odometerIn != null) {
      await tx.vehicle.updateMany({
        where: { id: data.vehicleId, garageId },
        data: { odometer: data.odometerIn },
      });
    }

    await tx.auditLog.create({
      data: {
        garageId,
        actorId: data.actorId,
        action: "service_order.updated",
        entity: "ServiceOrder",
        entityId: orderId,
        meta: {
          complaint: data.complaint,
          priority: data.priority,
          bay: data.bay,
          technicianIds,
        } satisfies Prisma.InputJsonValue,
      },
    });

    return order;
  });
}

export async function updateServiceOrderStatus(
  garageId: string,
  orderId: string,
  data: {
    from: ServiceOrderStatus;
    to: ServiceOrderStatus;
    actorId: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    const result = await tx.serviceOrder.updateMany({
      where: { id: orderId, garageId, status: data.from },
      data: { status: data.to },
    });

    if (result.count === 0) {
      return null;
    }

    await tx.auditLog.create({
      data: {
        garageId,
        actorId: data.actorId,
        action: "service_order.status_changed",
        entity: "ServiceOrder",
        entityId: orderId,
        meta: {
          from: data.from,
          to: data.to,
        } satisfies Prisma.InputJsonValue,
      },
    });

    return findServiceOrderById(garageId, orderId);
  });
}

export type CreateServiceOrderLineResult =
  | {
      ok: true;
      line: {
        id: string;
        garageId: string;
        serviceOrderId: string;
        type: ServiceOrderLineType;
        description: string;
        quantity: number;
        unitPricePaise: number;
        partId: string | null;
        sortOrder: number;
        createdAt: Date;
        updatedAt: Date;
      };
    }
  | { ok: false; reason: "PART_NOT_FOUND" };

/**
 * Adds a labour/part line. Stock is not reduced here — parts leave inventory
 * only when the matching estimate line is approved.
 */
export async function createServiceOrderLine(
  garageId: string,
  data: {
    serviceOrderId: string;
    type: ServiceOrderLineType;
    description: string;
    quantity: number;
    unitPricePaise: number;
    partId: string | null;
    actorId: string;
  },
): Promise<CreateServiceOrderLineResult> {
  try {
    const line = await prisma.$transaction(async (tx) => {
      if (data.type === "PART" && data.partId) {
        const part = await tx.part.findFirst({
          where: { id: data.partId, garageId },
          select: { id: true },
        });
        if (!part) {
          throw new StockLineTxError("PART_NOT_FOUND");
        }
      }

      const maxSort = await tx.serviceOrderLine.aggregate({
        where: { garageId, serviceOrderId: data.serviceOrderId },
        _max: { sortOrder: true },
      });
      const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;

      const created = await tx.serviceOrderLine.create({
        data: {
          garageId,
          serviceOrderId: data.serviceOrderId,
          type: data.type,
          description: data.description,
          quantity: data.quantity,
          unitPricePaise: data.unitPricePaise,
          partId: data.type === "PART" ? data.partId : null,
          sortOrder,
        },
        select: lineSelect,
      });

      await tx.auditLog.create({
        data: {
          garageId,
          actorId: data.actorId,
          action: "service_order.line_added",
          entity: "ServiceOrder",
          entityId: data.serviceOrderId,
          meta: {
            lineId: created.id,
            type: data.type,
            description: data.description,
            quantity: data.quantity,
            unitPricePaise: data.unitPricePaise,
            partId: data.partId,
          } satisfies Prisma.InputJsonValue,
        },
      });

      return created;
    });

    return { ok: true, line };
  } catch (error) {
    if (error instanceof StockLineTxError) {
      return { ok: false, reason: "PART_NOT_FOUND" };
    }
    throw error;
  }
}

type ServiceOrderLineRow = {
  id: string;
  garageId: string;
  serviceOrderId: string;
  type: ServiceOrderLineType;
  description: string;
  quantity: number;
  unitPricePaise: number;
  partId: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export type UpdateServiceOrderLineResult =
  | { ok: true; line: ServiceOrderLineRow }
  | { ok: false; reason: "NOT_FOUND" };

export async function updateServiceOrderLine(
  garageId: string,
  data: {
    lineId: string;
    serviceOrderId: string;
    description: string;
    quantity: number;
    unitPricePaise: number;
    partId?: string | null;
    actorId: string;
  },
): Promise<UpdateServiceOrderLineResult> {
  try {
    const line = await prisma.$transaction(async (tx) => {
      const existing = await tx.serviceOrderLine.findFirst({
        where: {
          id: data.lineId,
          garageId,
          serviceOrderId: data.serviceOrderId,
        },
        select: lineSelect,
      });
      if (!existing) {
        throw new StockLineTxError("NOT_FOUND");
      }

      const nextPartId =
        existing.type === "PART" && data.partId !== undefined
          ? data.partId
          : existing.partId;

      if (existing.type === "PART" && nextPartId) {
        const part = await tx.part.findFirst({
          where: { id: nextPartId, garageId },
          select: { id: true },
        });
        if (!part) {
          throw new StockLineTxError("PART_NOT_FOUND");
        }
      }

      const updated = await tx.serviceOrderLine.update({
        where: { id: existing.id },
        data: {
          description: data.description,
          quantity: data.quantity,
          unitPricePaise: data.unitPricePaise,
          ...(existing.type === "PART" && data.partId !== undefined
            ? { partId: nextPartId }
            : {}),
        },
        select: lineSelect,
      });

      await tx.auditLog.create({
        data: {
          garageId,
          actorId: data.actorId,
          action: "service_order.line_updated",
          entity: "ServiceOrder",
          entityId: data.serviceOrderId,
          meta: {
            lineId: updated.id,
            type: updated.type,
            description: updated.description,
            quantity: updated.quantity,
            unitPricePaise: updated.unitPricePaise,
            partId: updated.partId,
            previousQuantity: existing.quantity,
            previousUnitPricePaise: existing.unitPricePaise,
            previousPartId: existing.partId,
          } satisfies Prisma.InputJsonValue,
        },
      });

      return updated;
    });

    return { ok: true, line };
  } catch (error) {
    if (error instanceof StockLineTxError) {
      if (error.reason === "PART_NOT_FOUND") {
        return { ok: false, reason: "NOT_FOUND" };
      }
      return { ok: false, reason: "NOT_FOUND" };
    }
    throw error;
  }
}

export type DeleteServiceOrderLineResult =
  | { ok: true }
  | { ok: false; reason: "NOT_FOUND" | "BILLED_ON_FINALIZED_INVOICE" };

export async function deleteServiceOrderLine(
  garageId: string,
  data: {
    lineId: string;
    serviceOrderId: string;
    actorId: string;
  },
): Promise<DeleteServiceOrderLineResult> {
  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.serviceOrderLine.findFirst({
        where: {
          id: data.lineId,
          garageId,
          serviceOrderId: data.serviceOrderId,
        },
        select: lineSelect,
      });
      if (!existing) {
        throw new StockLineTxError("NOT_FOUND");
      }

      // Cascade current-estimate lines (any approval). Draft invoice lines go
      // with them; only a finalized bill blocks delete.
      const linkedEstimateLines = await tx.estimateLine.findMany({
        where: {
          garageId,
          sourceOrderLineId: existing.id,
          estimate: {
            serviceOrderId: data.serviceOrderId,
            supersededAt: null,
          },
        },
        select: {
          id: true,
          estimateId: true,
          type: true,
          description: true,
          quantity: true,
          approvalState: true,
          sourceOrderLineId: true,
          sourceSuggestedRepairId: true,
        },
      });

      for (const estLine of linkedEstimateLines) {
        const billed = await tx.invoiceLine.count({
          where: {
            garageId,
            estimateLineId: estLine.id,
            invoice: { status: "FINALIZED" },
          },
        });
        if (billed > 0) {
          throw new StockLineTxError("BILLED_ON_FINALIZED_INVOICE");
        }

        if (estLine.approvalState === "APPROVED") {
          const linked = await findLinkedPartLine(tx, garageId, estLine);
          if (linked) {
            await applyApprovedPartStock(tx, garageId, {
              partId: linked.partId,
              serviceOrderId: data.serviceOrderId,
              serviceOrderLineId: linked.serviceOrderLineId,
              quantity: estLine.quantity,
              type: "IN",
              actorId: data.actorId,
              note: `Job-card line removed ${data.serviceOrderId} (estimate line ${estLine.id})`,
            });
          }
        }

        await removeDraftInvoiceLinesForEstimateLine(tx, garageId, estLine.id);

        await tx.estimateLine.delete({ where: { id: estLine.id } });

        await tx.auditLog.create({
          data: {
            garageId,
            actorId: data.actorId,
            action: "estimate.line_removed",
            entity: "EstimateLine",
            entityId: estLine.id,
            meta: {
              serviceOrderId: data.serviceOrderId,
              estimateId: estLine.estimateId,
              description: estLine.description,
              cascadedFromOrderLineId: existing.id,
            } satisfies Prisma.InputJsonValue,
          },
        });
      }

      await tx.serviceOrderLine.delete({ where: { id: existing.id } });

      await tx.auditLog.create({
        data: {
          garageId,
          actorId: data.actorId,
          action: "service_order.line_removed",
          entity: "ServiceOrder",
          entityId: data.serviceOrderId,
          meta: {
            lineId: existing.id,
            type: existing.type,
            description: existing.description,
            quantity: existing.quantity,
            unitPricePaise: existing.unitPricePaise,
            partId: existing.partId,
          } satisfies Prisma.InputJsonValue,
        },
      });
    });

    return { ok: true };
  } catch (error) {
    if (error instanceof StockLineTxError) {
      if (error.reason === "BILLED_ON_FINALIZED_INVOICE") {
        return { ok: false, reason: "BILLED_ON_FINALIZED_INVOICE" };
      }
      return { ok: false, reason: "NOT_FOUND" };
    }
    if (error instanceof EstimateStockTxError) {
      return { ok: false, reason: "NOT_FOUND" };
    }
    throw error;
  }
}

class StockLineTxError extends Error {
  readonly reason: "NOT_FOUND" | "PART_NOT_FOUND" | "BILLED_ON_FINALIZED_INVOICE";

  constructor(
    reason: "NOT_FOUND" | "PART_NOT_FOUND" | "BILLED_ON_FINALIZED_INVOICE",
  ) {
    super(reason);
    this.name = "StockLineTxError";
    this.reason = reason;
  }
}

export async function listServiceOrderAuditLogs(
  garageId: string,
  orderId: string,
) {
  return prisma.auditLog.findMany({
    where: {
      garageId,
      entity: "ServiceOrder",
      entityId: orderId,
    },
    select: {
      id: true,
      action: true,
      meta: true,
      createdAt: true,
      actor: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function deleteServiceOrderById(
  garageId: string,
  orderId: string,
  data: {
    actorId: string;
    vehicleId: string;
    customerId: string;
    registrationNumber: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.serviceOrder.findFirst({
      where: { id: orderId, garageId },
      select: { id: true, status: true, complaint: true },
    });
    if (!existing) {
      return null;
    }

    // Return any stock still held by this job (Agree OUT with no Disagree IN).
    const held = await tx.stockMovement.groupBy({
      by: ["partId"],
      where: { garageId, serviceOrderId: orderId },
      _sum: { quantityChange: true },
    });
    for (const row of held) {
      const net = row._sum.quantityChange ?? 0;
      if (net >= 0) {
        continue;
      }
      const restored = await applyStockMovement(
        garageId,
        {
          partId: row.partId,
          type: "IN",
          quantity: -net,
          note: `Job card deleted ${orderId}`,
          actorId: data.actorId,
          serviceOrderId: orderId,
          serviceOrderLineId: null,
        },
        tx,
      );
      if (!restored.ok) {
        throw new Error(`STOCK_RESTORE_FAILED:${restored.reason}`);
      }
    }

    await tx.serviceOrder.delete({
      where: { id: orderId },
    });

    await tx.auditLog.create({
      data: {
        garageId,
        actorId: data.actorId,
        action: "service_order.deleted",
        entity: "ServiceOrder",
        entityId: orderId,
        meta: {
          status: existing.status,
          complaint: existing.complaint,
          vehicleId: data.vehicleId,
          customerId: data.customerId,
          registrationNumber: data.registrationNumber,
        } satisfies Prisma.InputJsonValue,
      },
    });

    return existing;
  });
}

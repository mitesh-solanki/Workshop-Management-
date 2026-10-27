import "server-only";

import type {
  Prisma,
  ServiceOrderLineType,
  ServiceOrderPriority,
  ServiceOrderStatus,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { applyStockMovement } from "@/modules/inventory/repo";

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
} as const;

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
      garageId,
      ...(options.technicianId
        ? { technicianId: options.technicianId }
        : {}),
      ...(options.bay ? { bay: options.bay } : {}),
    },
    select: orderListSelect,
    orderBy: [{ createdAt: "desc" }],
    take: 200,
  });
}

export async function listServiceOrdersByCustomer(
  garageId: string,
  customerId: string,
) {
  return prisma.serviceOrder.findMany({
    where: { garageId, customerId },
    select: {
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
    },
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
        select: lineSelect,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });
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
    technicianId: string | null;
    bay: string | null;
    priority: ServiceOrderPriority;
    actorId: string;
  },
) {
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
        technicianId: data.technicianId,
        bay: data.bay,
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
    technicianId: string | null;
    bay: string | null;
    priority: ServiceOrderPriority;
    vehicleId: string;
    actorId: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.serviceOrder.findFirst({
      where: { id: orderId, garageId },
      select: { id: true },
    });
    if (!existing) {
      return null;
    }

    const order = await tx.serviceOrder.update({
      where: { id: orderId },
      data: {
        complaint: data.complaint,
        requestedServices: data.requestedServices,
        odometerIn: data.odometerIn,
        expectedCompletion: data.expectedCompletion,
        technicianId: data.technicianId,
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
          technicianId: data.technicianId,
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
  | { ok: false; reason: "PART_NOT_FOUND" | "INSUFFICIENT_STOCK" };

/**
 * Adds a labour/part line. When type is PART and partId is set, creates a
 * StockMovement OUT in the same transaction (inventory is the only stock path).
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

      if (data.type === "PART" && data.partId) {
        const stock = await applyStockMovement(
          garageId,
          {
            partId: data.partId,
            type: "OUT",
            quantity: data.quantity,
            note: `Service order ${data.serviceOrderId}`,
            actorId: data.actorId,
            serviceOrderId: data.serviceOrderId,
            serviceOrderLineId: created.id,
          },
          tx,
        );
        if (!stock.ok) {
          throw new StockLineTxError(stock.reason);
        }
      }

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
      if (error.reason === "NOT_FOUND") {
        return { ok: false, reason: "PART_NOT_FOUND" };
      }
      return { ok: false, reason: error.reason };
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
  | { ok: false; reason: "NOT_FOUND" | "PART_NOT_FOUND" | "INSUFFICIENT_STOCK" };

export async function updateServiceOrderLine(
  garageId: string,
  data: {
    lineId: string;
    serviceOrderId: string;
    description: string;
    quantity: number;
    unitPricePaise: number;
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

      const quantityDelta = data.quantity - existing.quantity;
      if (
        existing.type === "PART" &&
        existing.partId &&
        quantityDelta !== 0
      ) {
        // Do not set serviceOrderLineId - the original OUT already owns that
        // unique FK. Later qty adjustments are extra movements on the order.
        const stock = await applyStockMovement(
          garageId,
          {
            partId: existing.partId,
            type: quantityDelta > 0 ? "OUT" : "IN",
            quantity: Math.abs(quantityDelta),
            note: `Service order line update ${data.serviceOrderId} (line ${existing.id})`,
            actorId: data.actorId,
            serviceOrderId: data.serviceOrderId,
          },
          tx,
        );
        if (!stock.ok) {
          throw new StockLineTxError(stock.reason);
        }
      }

      const updated = await tx.serviceOrderLine.update({
        where: { id: existing.id },
        data: {
          description: data.description,
          quantity: data.quantity,
          unitPricePaise: data.unitPricePaise,
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
            previousQuantity: existing.quantity,
            previousUnitPricePaise: existing.unitPricePaise,
          } satisfies Prisma.InputJsonValue,
        },
      });

      return updated;
    });

    return { ok: true, line };
  } catch (error) {
    if (error instanceof StockLineTxError) {
      return { ok: false, reason: error.reason };
    }
    throw error;
  }
}

export type DeleteServiceOrderLineResult =
  | { ok: true }
  | { ok: false; reason: "NOT_FOUND" | "PART_NOT_FOUND" | "INSUFFICIENT_STOCK" };

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

      if (existing.type === "PART" && existing.partId) {
        // Return stock without serviceOrderLineId - that unique slot is already
        // used by the OUT created when the part line was added.
        const stock = await applyStockMovement(
          garageId,
          {
            partId: existing.partId,
            type: "IN",
            quantity: existing.quantity,
            note: `Service order line removed ${data.serviceOrderId} (line ${existing.id})`,
            actorId: data.actorId,
            serviceOrderId: data.serviceOrderId,
          },
          tx,
        );
        if (!stock.ok) {
          throw new StockLineTxError(stock.reason);
        }
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
      return { ok: false, reason: error.reason };
    }
    throw error;
  }
}

class StockLineTxError extends Error {
  readonly reason: "NOT_FOUND" | "PART_NOT_FOUND" | "INSUFFICIENT_STOCK";

  constructor(reason: "NOT_FOUND" | "PART_NOT_FOUND" | "INSUFFICIENT_STOCK") {
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
    orderBy: { createdAt: "asc" },
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

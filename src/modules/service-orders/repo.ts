import "server-only";

import type {
  Prisma,
  ServiceOrderLineType,
  ServiceOrderPriority,
  ServiceOrderStatus,
} from "@prisma/client";
import { prisma } from "@/lib/db";

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
) {
  return prisma.$transaction(async (tx) => {
    const maxSort = await tx.serviceOrderLine.aggregate({
      where: { garageId, serviceOrderId: data.serviceOrderId },
      _max: { sortOrder: true },
    });
    const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;

    const line = await tx.serviceOrderLine.create({
      data: {
        garageId,
        serviceOrderId: data.serviceOrderId,
        type: data.type,
        description: data.description,
        quantity: data.quantity,
        unitPricePaise: data.unitPricePaise,
        partId: data.partId,
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
          lineId: line.id,
          type: data.type,
          description: data.description,
          quantity: data.quantity,
          unitPricePaise: data.unitPricePaise,
        } satisfies Prisma.InputJsonValue,
      },
    });

    return line;
  });
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

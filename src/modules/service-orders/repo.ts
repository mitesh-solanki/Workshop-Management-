import "server-only";

import type {
  Prisma,
  ServiceOrderLineType,
  ServiceOrderPriority,
  ServiceOrderStatus,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { removeDraftInvoiceLinesForEstimateLine } from "@/modules/estimates/repo";
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
  vendorId: true,
  gstSplit: true,
  gstRatePercent: true,
  billStorageKey: true,
  billContentType: true,
  billFileName: true,
  billByteSize: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** PART lines still at ₹0 with no catalogue selling price (mechanic-added / buy-to-price). */
const unpricedPartLineWhere = {
  type: "PART" as const,
  unitPricePaise: 0,
  OR: [{ partId: null }, { part: { sellingPricePaise: { lte: 0 } } }],
} satisfies Prisma.ServiceOrderLineWhereInput;

const orderListSelect = {
  id: true,
  garageId: true,
  vehicleId: true,
  customerId: true,
  jobCardNumber: true,
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
      gstin: true,
      stateCode: true,
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
    where: unpricedPartLineWhere,
    select: { id: true },
    take: 1,
  },
} satisfies Prisma.ServiceOrderSelect;

const orderListWithPaperSelect = {
  ...orderListSelect,
  paperCopies: {
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
    select: orderListWithPaperSelect,
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

/** Open jobs with expected completion inside a calendar window (e.g. today–tomorrow). */
export async function listServiceOrdersDueInWindow(
  garageId: string,
  window: { start: Date; end: Date },
  options: { technicianId?: string } = {},
) {
  return prisma.serviceOrder.findMany({
    where: {
      ...serviceOrderScopeWhere(garageId, options),
      status: { not: "COMPLETED" },
      expectedCompletion: {
        gte: window.start,
        lt: window.end,
      },
    },
    select: orderListSelect,
    orderBy: [
      { expectedCompletion: "asc" },
      { createdAt: "desc" },
    ],
    take: 25,
  });
}

/** Open jobs for a single status (home queues / filtered lists). */
export async function listServiceOrdersByStatus(
  garageId: string,
  status: ServiceOrderStatusValue,
  options: { technicianId?: string } = {},
) {
  return prisma.serviceOrder.findMany({
    where: {
      ...serviceOrderScopeWhere(garageId, options),
      status,
    },
    select: orderListSelect,
    orderBy: [
      { expectedCompletion: "asc" },
      { createdAt: "desc" },
    ],
    take: 25,
  });
}

/** Open jobs with at least one unpriced PART line (mechanic added, no catalogue price). */
export async function listServiceOrdersNeedingPricing(
  garageId: string,
  options: { technicianId?: string } = {},
) {
  return prisma.serviceOrder.findMany({
    where: {
      ...serviceOrderScopeWhere(garageId, options),
      status: { not: "COMPLETED" },
      lines: { some: unpricedPartLineWhere },
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
  jobCardNumber: true,
  status: true,
  complaint: true,
  bay: true,
  odometerIn: true,
  createdAt: true,
  expectedCompletion: true,
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
      name: true,
      phone: true,
      address: true,
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
    select: {
      id: true,
      type: true,
      description: true,
      quantity: true,
      unitPricePaise: true,
      partId: true,
      part: {
        select: {
          sellingPricePaise: true,
        },
      },
    },
    orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }],
  },
  paperCopies: {
    select: {
      id: true,
      storageKey: true,
      contentType: true,
      fileName: true,
    },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.ServiceOrderSelect;

const paperCopySelect = {
  id: true,
  garageId: true,
  serviceOrderId: true,
  storageKey: true,
  contentType: true,
  fileName: true,
  byteSize: true,
  createdById: true,
  createdAt: true,
} as const;

export async function listServiceOrdersByCustomer(
  garageId: string,
  customerId: string,
  options: { technicianId?: string } = {},
) {
  return prisma.serviceOrder.findMany({
    where: {
      garageId,
      customerId,
      ...(options.technicianId
        ? { AND: [assignedTechnicianWhere(options.technicianId)] }
        : {}),
    },
    select: historySelect,
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function listServiceOrdersByVehicle(
  garageId: string,
  vehicleId: string,
  options: { technicianId?: string } = {},
) {
  return prisma.serviceOrder.findMany({
    where: {
      garageId,
      vehicleId,
      ...(options.technicianId
        ? { AND: [assignedTechnicianWhere(options.technicianId)] }
        : {}),
    },
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
          part: {
            select: {
              sellingPricePaise: true,
              gstRatePercent: true,
              hsn: true,
            },
          },
          vendor: {
            select: {
              id: true,
              name: true,
            },
          },
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

export class JobCardNumberConflictError extends Error {
  constructor() {
    super("JOB_CARD_NUMBER_EXISTS");
    this.name = "JobCardNumberConflictError";
  }
}

export async function getNextJobCardNumber(garageId: string): Promise<number> {
  const counter = await prisma.jobCardNumberCounter.findUnique({
    where: { garageId },
    select: { lastNumber: true },
  });
  return (counter?.lastNumber ?? 0) + 1;
}

export async function getMaxJobCardNumber(garageId: string): Promise<number> {
  const result = await prisma.serviceOrder.aggregate({
    where: { garageId },
    _max: { jobCardNumber: true },
  });
  return result._max.jobCardNumber ?? 0;
}

/**
 * Settings seed: Next Job Card Number = N means suggestion becomes N
 * (stores lastNumber = N - 1). Must be greater than max existing.
 */
export async function setNextJobCardNumberSeed(
  garageId: string,
  nextNumber: number,
): Promise<number> {
  const maxUsed = await getMaxJobCardNumber(garageId);
  if (nextNumber <= maxUsed) {
    throw new Error("JOB_CARD_NUMBER_SEED_TOO_LOW");
  }

  await prisma.jobCardNumberCounter.upsert({
    where: { garageId },
    create: {
      id: `jcn_${garageId}`,
      garageId,
      lastNumber: nextNumber - 1,
    },
    update: { lastNumber: nextNumber - 1 },
  });

  return nextNumber;
}

async function claimJobCardNumber(
  tx: Prisma.TransactionClient,
  garageId: string,
  chosen: number,
  excludeOrderId?: string,
): Promise<void> {
  await tx.$executeRaw`
    INSERT INTO "JobCardNumberCounter" ("id", "garageId", "lastNumber")
    VALUES (${`jcn_${garageId}`}, ${garageId}, 0)
    ON CONFLICT ("garageId") DO NOTHING
  `;

  const locked = await tx.$queryRaw<
    Array<{ id: string; lastNumber: number }>
  >`
    SELECT id, "lastNumber" FROM "JobCardNumberCounter"
    WHERE "garageId" = ${garageId}
    FOR UPDATE
  `;

  const row = locked[0];
  if (!row) {
    throw new Error("JobCardNumberCounter lock failed");
  }

  const duplicate = await tx.serviceOrder.findFirst({
    where: {
      garageId,
      jobCardNumber: chosen,
      ...(excludeOrderId ? { NOT: { id: excludeOrderId } } : {}),
    },
    select: { id: true },
  });
  if (duplicate) {
    throw new JobCardNumberConflictError();
  }

  const nextLast = Math.max(row.lastNumber, chosen);
  if (nextLast !== row.lastNumber) {
    await tx.jobCardNumberCounter.update({
      where: { id: row.id },
      data: { lastNumber: nextLast },
    });
  }
}

export async function createServiceOrder(
  garageId: string,
  data: {
    vehicleId: string;
    customerId: string;
    jobCardNumber: number;
    complaint: string;
    requestedServices: string | null;
    odometerIn: number | null;
    expectedCompletion: Date | null;
    technicianIds: string[];
    bay: string | null;
    priority: ServiceOrderPriority;
    status: ServiceOrderStatusValue;
    actorId: string;
  },
) {
  const technicianIds = [...new Set(data.technicianIds.filter(Boolean))];
  const primaryTechnicianId = technicianIds[0] ?? null;
  const status = data.status === "WAITING" ? "IN_PROGRESS" : data.status;

  return prisma.$transaction(async (tx) => {
    await claimJobCardNumber(tx, garageId, data.jobCardNumber);

    const order = await tx.serviceOrder.create({
      data: {
        garageId,
        vehicleId: data.vehicleId,
        customerId: data.customerId,
        jobCardNumber: data.jobCardNumber,
        status,
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
          to: status,
          created: true,
          technicianIds,
          jobCardNumber: data.jobCardNumber,
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
    jobCardNumber: number;
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
      select: { id: true, jobCardNumber: true },
    });
    if (!existing) {
      return null;
    }

    if (existing.jobCardNumber !== data.jobCardNumber) {
      await claimJobCardNumber(tx, garageId, data.jobCardNumber, orderId);
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
        jobCardNumber: data.jobCardNumber,
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
          jobCardNumber: data.jobCardNumber,
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

type ServiceOrderLineRow = {
  id: string;
  garageId: string;
  serviceOrderId: string;
  type: ServiceOrderLineType;
  description: string;
  quantity: number;
  unitPricePaise: number;
  partId: string | null;
  vendorId: string | null;
  gstSplit: "CGST_SGST" | "IGST" | null;
  gstRatePercent: number | null;
  billStorageKey: string | null;
  billContentType: string | null;
  billFileName: string | null;
  billByteSize: number | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateServiceOrderLineResult =
  | { ok: true; line: ServiceOrderLineRow }
  | {
    ok: false;
    reason: "PART_NOT_FOUND" | "INSUFFICIENT_STOCK" | "VENDOR_NOT_FOUND";
    partName?: string;
  };

/**
 * Adds a labour/part line. PART lines with a catalogue part deduct stock now
 * (workshop uses the part when it is added on the job card).
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
    vendorId?: string | null;
    gstSplit?: "CGST_SGST" | "IGST" | null;
    gstRatePercent?: number | null;
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

      if (data.type === "OUTSIDE" && data.vendorId) {
        const vendor = await tx.vendor.findFirst({
          where: { id: data.vendorId, garageId },
          select: { id: true },
        });
        if (!vendor) {
          throw new Error("VENDOR_NOT_FOUND");
        }
      }

      const maxSort = await tx.serviceOrderLine.aggregate({
        where: { garageId, serviceOrderId: data.serviceOrderId },
        _max: { sortOrder: true },
      });
      const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;
      const isOutside = data.type === "OUTSIDE";

      const created = await tx.serviceOrderLine.create({
        data: {
          garageId,
          serviceOrderId: data.serviceOrderId,
          type: data.type,
          description: data.description,
          quantity: data.quantity,
          unitPricePaise: data.unitPricePaise,
          partId: data.type === "PART" ? data.partId : null,
          vendorId: isOutside ? (data.vendorId ?? null) : null,
          gstSplit: isOutside ? (data.gstSplit ?? null) : null,
          gstRatePercent: isOutside ? (data.gstRatePercent ?? null) : null,
          sortOrder,
        },
        select: lineSelect,
      });

      if (
        data.type === "PART" &&
        data.partId &&
        data.quantity > 0
      ) {
        await issueJobCardPartStock(tx, garageId, {
          partId: data.partId,
          serviceOrderId: data.serviceOrderId,
          serviceOrderLineId: created.id,
          quantity: data.quantity,
          type: "OUT",
          actorId: data.actorId,
          note: `Job card part added ${data.serviceOrderId}`,
        });
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
            vendorId: created.vendorId,
            gstSplit: created.gstSplit,
            gstRatePercent: created.gstRatePercent,
          } satisfies Prisma.InputJsonValue,
        },
      });

      return created;
    });

    return { ok: true, line };
  } catch (error) {
    if (error instanceof Error && error.message === "VENDOR_NOT_FOUND") {
      return { ok: false, reason: "VENDOR_NOT_FOUND" };
    }
    if (error instanceof StockLineTxError) {
      if (error.reason === "INSUFFICIENT_STOCK") {
        return {
          ok: false,
          reason: "INSUFFICIENT_STOCK",
          partName: error.partName,
        };
      }
      return { ok: false, reason: "PART_NOT_FOUND" };
    }
    throw error;
  }
}

export type UpdateServiceOrderLineResult =
  | { ok: true; line: ServiceOrderLineRow }
  | {
    ok: false;
    reason: "NOT_FOUND" | "INSUFFICIENT_STOCK" | "VENDOR_NOT_FOUND";
    partName?: string;
  };

export async function updateServiceOrderLine(
  garageId: string,
  data: {
    lineId: string;
    serviceOrderId: string;
    description: string;
    quantity: number;
    unitPricePaise: number;
    partId?: string | null;
    vendorId?: string | null;
    gstSplit?: "CGST_SGST" | "IGST" | null;
    gstRatePercent?: number | null;
    clearBill?: boolean;
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

      if (existing.type === "OUTSIDE" && data.vendorId) {
        const vendor = await tx.vendor.findFirst({
          where: { id: data.vendorId, garageId },
          select: { id: true },
        });
        if (!vendor) {
          throw new Error("VENDOR_NOT_FOUND");
        }
      }

      if (existing.type === "PART") {
        await adjustJobCardPartStock(tx, garageId, {
          serviceOrderId: data.serviceOrderId,
          serviceOrderLineId: existing.id,
          previousPartId: existing.partId,
          previousQuantity: existing.quantity,
          nextPartId,
          nextQuantity: data.quantity,
          actorId: data.actorId,
        });
      }

      const nextGstRate =
        existing.type === "OUTSIDE" && data.gstRatePercent !== undefined
          ? data.gstRatePercent
          : existing.gstRatePercent;
      const shouldClearBill =
        existing.type === "OUTSIDE" &&
        (data.clearBill ||
          (typeof nextGstRate === "number" &&
            nextGstRate <= 0 &&
            Boolean(existing.billStorageKey)));

      const updated = await tx.serviceOrderLine.update({
        where: { id: existing.id },
        data: {
          description: data.description,
          quantity: data.quantity,
          unitPricePaise: data.unitPricePaise,
          ...(existing.type === "PART" && data.partId !== undefined
            ? { partId: nextPartId }
            : {}),
          ...(existing.type === "OUTSIDE"
            ? {
                ...(data.vendorId !== undefined
                  ? { vendorId: data.vendorId }
                  : {}),
                ...(data.gstSplit !== undefined
                  ? { gstSplit: data.gstSplit }
                  : {}),
                ...(data.gstRatePercent !== undefined
                  ? { gstRatePercent: data.gstRatePercent }
                  : {}),
                ...(shouldClearBill
                  ? {
                      billStorageKey: null,
                      billContentType: null,
                      billFileName: null,
                      billByteSize: null,
                    }
                  : {}),
              }
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
            vendorId: updated.vendorId,
            gstSplit: updated.gstSplit,
            gstRatePercent: updated.gstRatePercent,
            previousDescription: existing.description,
            previousQuantity: existing.quantity,
            previousUnitPricePaise: existing.unitPricePaise,
            previousPartId: existing.partId,
            previousVendorId: existing.vendorId,
            previousGstSplit: existing.gstSplit,
            previousGstRatePercent: existing.gstRatePercent,
          } satisfies Prisma.InputJsonValue,
        },
      });

      return updated;
    });

    return { ok: true, line };
  } catch (error) {
    if (error instanceof Error && error.message === "VENDOR_NOT_FOUND") {
      return { ok: false, reason: "VENDOR_NOT_FOUND" };
    }
    if (error instanceof StockLineTxError) {
      if (error.reason === "INSUFFICIENT_STOCK") {
        return {
          ok: false,
          reason: "INSUFFICIENT_STOCK",
          partName: error.partName,
        };
      }
      return { ok: false, reason: "NOT_FOUND" };
    }
    throw error;
  }
}

export async function setOutsideWorkBill(
  garageId: string,
  input: {
    serviceOrderId: string;
    lineId: string;
    storageKey: string;
    contentType: string;
    fileName: string | null;
    byteSize: number;
    actorId: string;
  },
) {
  const existing = await prisma.serviceOrderLine.findFirst({
    where: {
      id: input.lineId,
      garageId,
      serviceOrderId: input.serviceOrderId,
      type: "OUTSIDE",
    },
    select: lineSelect,
  });
  if (!existing) return null;

  const previousStorageKey = existing.billStorageKey;
  const line = await prisma.serviceOrderLine.update({
    where: { id: existing.id },
    data: {
      billStorageKey: input.storageKey,
      billContentType: input.contentType,
      billFileName: input.fileName,
      billByteSize: input.byteSize,
    },
    select: lineSelect,
  });

  await prisma.auditLog.create({
    data: {
      garageId,
      actorId: input.actorId,
      action: "service_order.outside_work_bill_uploaded",
      entity: "ServiceOrder",
      entityId: input.serviceOrderId,
      meta: {
        lineId: line.id,
        billFileName: input.fileName,
        billByteSize: input.byteSize,
        billContentType: input.contentType,
      } satisfies Prisma.InputJsonValue,
    },
  });

  return { line, previousStorageKey };
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
          description: true,
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

      // One-bill drafts: drop matching paper lines when the job-card line goes.
      const matchingDraftLines = await tx.invoiceLine.findMany({
        where: {
          garageId,
          description: existing.description,
          type: existing.type as "LABOUR" | "PART" | "OUTSIDE",
          quantity: existing.quantity,
          unitPricePaise: existing.unitPricePaise,
          invoice: {
            garageId,
            serviceOrderId: data.serviceOrderId,
            status: "DRAFT",
          },
        },
        select: { id: true, invoiceId: true },
      });
      if (matchingDraftLines.length > 0) {
        const invoiceIds = [
          ...new Set(matchingDraftLines.map((line) => line.invoiceId)),
        ];
        await tx.invoiceLine.deleteMany({
          where: {
            garageId,
            id: { in: matchingDraftLines.map((line) => line.id) },
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
              taxablePaise: remaining.reduce(
                (sum, line) => sum + line.taxablePaise,
                0,
              ),
              cgstPaise: remaining.reduce((sum, line) => sum + line.cgstPaise, 0),
              sgstPaise: remaining.reduce((sum, line) => sum + line.sgstPaise, 0),
              igstPaise: remaining.reduce((sum, line) => sum + line.igstPaise, 0),
              totalPaise: remaining.reduce(
                (sum, line) => sum + line.totalPaise,
                0,
              ),
            },
          });
        }
      }

      if (
        existing.type === "PART" &&
        existing.partId &&
        existing.quantity > 0
      ) {
        await issueJobCardPartStock(tx, garageId, {
          partId: existing.partId,
          serviceOrderId: data.serviceOrderId,
          serviceOrderLineId: existing.id,
          quantity: existing.quantity,
          type: "IN",
          actorId: data.actorId,
          note: `Job card part removed ${data.serviceOrderId}`,
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
    throw error;
  }
}

class StockLineTxError extends Error {
  readonly reason:
    | "NOT_FOUND"
    | "PART_NOT_FOUND"
    | "BILLED_ON_FINALIZED_INVOICE"
    | "INSUFFICIENT_STOCK";
  readonly partName?: string;

  constructor(
    reason:
      | "NOT_FOUND"
      | "PART_NOT_FOUND"
      | "BILLED_ON_FINALIZED_INVOICE"
      | "INSUFFICIENT_STOCK",
    partName?: string,
  ) {
    super(reason);
    this.name = "StockLineTxError";
    this.reason = reason;
    this.partName = partName;
  }
}

async function issueJobCardPartStock(
  tx: Prisma.TransactionClient,
  garageId: string,
  data: {
    partId: string;
    serviceOrderId: string;
    serviceOrderLineId: string;
    quantity: number;
    type: "IN" | "OUT";
    actorId: string;
    note: string;
  },
) {
  if (data.quantity <= 0) {
    return;
  }

  // serviceOrderLineId is unique on StockMovement — only attach it on the
  // first OUT for that job-card line. Later returns / re-issues stay unlinked.
  let serviceOrderLineId: string | null = null;
  if (data.type === "OUT") {
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
    throw new StockLineTxError(
      stock.reason === "INSUFFICIENT_STOCK"
        ? "INSUFFICIENT_STOCK"
        : "PART_NOT_FOUND",
      stock.reason === "INSUFFICIENT_STOCK" ? stock.partName : undefined,
    );
  }
}

async function adjustJobCardPartStock(
  tx: Prisma.TransactionClient,
  garageId: string,
  data: {
    serviceOrderId: string;
    serviceOrderLineId: string;
    previousPartId: string | null;
    previousQuantity: number;
    nextPartId: string | null;
    nextQuantity: number;
    actorId: string;
  },
) {
  const prevPart = data.previousPartId;
  const nextPart = data.nextPartId;
  const prevQty = data.previousQuantity;
  const nextQty = data.nextQuantity;

  if (prevPart === nextPart) {
    if (!prevPart) {
      return;
    }
    const delta = nextQty - prevQty;
    if (delta === 0) {
      return;
    }
    await issueJobCardPartStock(tx, garageId, {
      partId: prevPart,
      serviceOrderId: data.serviceOrderId,
      serviceOrderLineId: data.serviceOrderLineId,
      quantity: Math.abs(delta),
      type: delta > 0 ? "OUT" : "IN",
      actorId: data.actorId,
      note:
        delta > 0
          ? `Job card part qty increased ${data.serviceOrderId}`
          : `Job card part qty decreased ${data.serviceOrderId}`,
    });
    return;
  }

  if (prevPart && prevQty > 0) {
    await issueJobCardPartStock(tx, garageId, {
      partId: prevPart,
      serviceOrderId: data.serviceOrderId,
      serviceOrderLineId: data.serviceOrderLineId,
      quantity: prevQty,
      type: "IN",
      actorId: data.actorId,
      note: `Job card part swapped out ${data.serviceOrderId}`,
    });
  }
  if (nextPart && nextQty > 0) {
    await issueJobCardPartStock(tx, garageId, {
      partId: nextPart,
      serviceOrderId: data.serviceOrderId,
      serviceOrderLineId: data.serviceOrderLineId,
      quantity: nextQty,
      type: "OUT",
      actorId: data.actorId,
      note: `Job card part swapped in ${data.serviceOrderId}`,
    });
  }
}

export async function listServiceOrderAuditLogs(
  garageId: string,
  orderId: string,
) {
  const invoices = await prisma.invoice.findMany({
    where: { garageId, serviceOrderId: orderId },
    select: { id: true },
  });
  const invoiceIds = invoices.map((invoice) => invoice.id);

  return prisma.auditLog.findMany({
    where: {
      garageId,
      OR: [
        { entity: "ServiceOrder", entityId: orderId },
        { meta: { path: ["serviceOrderId"], equals: orderId } },
        ...(invoiceIds.length > 0
          ? [
            { entity: "Invoice" as const, entityId: { in: invoiceIds } },
            ...invoiceIds.map((invoiceId) => ({
              meta: { path: ["invoiceId"], equals: invoiceId },
            })),
          ]
          : []),
      ],
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

export async function listPaperCopiesForOrder(
  garageId: string,
  serviceOrderId: string,
) {
  return prisma.serviceOrderPaperCopy.findMany({
    where: { garageId, serviceOrderId },
    select: paperCopySelect,
    orderBy: { createdAt: "asc" },
  });
}

export async function countPaperCopiesForOrder(
  garageId: string,
  serviceOrderId: string,
) {
  return prisma.serviceOrderPaperCopy.count({
    where: { garageId, serviceOrderId },
  });
}

export async function createPaperCopy(
  garageId: string,
  data: {
    serviceOrderId: string;
    storageKey: string;
    contentType: string;
    fileName?: string;
    byteSize: number;
    actorId: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.serviceOrder.findFirst({
      where: { id: data.serviceOrderId, garageId },
      select: {
        id: true,
        customerId: true,
        vehicleId: true,
      },
    });
    if (!order) {
      throw new Error("NOT_FOUND");
    }

    const row = await tx.serviceOrderPaperCopy.create({
      data: {
        garageId,
        serviceOrderId: data.serviceOrderId,
        storageKey: data.storageKey,
        contentType: data.contentType,
        fileName: data.fileName ?? null,
        byteSize: data.byteSize,
        createdById: data.actorId,
      },
      select: paperCopySelect,
    });

    await tx.auditLog.create({
      data: {
        garageId,
        actorId: data.actorId,
        action: "service_order.paper_copy_uploaded",
        entity: "ServiceOrderPaperCopy",
        entityId: row.id,
        meta: {
          serviceOrderId: data.serviceOrderId,
          customerId: order.customerId,
          vehicleId: order.vehicleId,
          contentType: data.contentType,
          fileName: data.fileName ?? null,
          byteSize: data.byteSize,
        } satisfies Prisma.InputJsonValue,
      },
    });

    return row;
  });
}

export async function deletePaperCopy(
  garageId: string,
  data: {
    serviceOrderId: string;
    paperCopyId: string;
    actorId: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.serviceOrderPaperCopy.findFirst({
      where: {
        id: data.paperCopyId,
        garageId,
        serviceOrderId: data.serviceOrderId,
      },
      select: paperCopySelect,
    });
    if (!existing) {
      return null;
    }

    await tx.serviceOrderPaperCopy.delete({
      where: { id: existing.id },
    });

    await tx.auditLog.create({
      data: {
        garageId,
        actorId: data.actorId,
        action: "service_order.paper_copy_removed",
        entity: "ServiceOrderPaperCopy",
        entityId: existing.id,
        meta: {
          serviceOrderId: data.serviceOrderId,
          storageKey: existing.storageKey,
          contentType: existing.contentType,
          fileName: existing.fileName,
        } satisfies Prisma.InputJsonValue,
      },
    });

    return existing;
  });
}

export async function replacePaperCopy(
  garageId: string,
  data: {
    serviceOrderId: string;
    paperCopyId: string;
    storageKey: string;
    contentType: string;
    fileName?: string;
    byteSize: number;
    actorId: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.serviceOrderPaperCopy.findFirst({
      where: {
        id: data.paperCopyId,
        garageId,
        serviceOrderId: data.serviceOrderId,
      },
      select: paperCopySelect,
    });
    if (!existing) {
      return null;
    }

    const row = await tx.serviceOrderPaperCopy.update({
      where: { id: existing.id },
      data: {
        storageKey: data.storageKey,
        contentType: data.contentType,
        fileName: data.fileName ?? null,
        byteSize: data.byteSize,
      },
      select: paperCopySelect,
    });

    await tx.auditLog.create({
      data: {
        garageId,
        actorId: data.actorId,
        action: "service_order.paper_copy_replaced",
        entity: "ServiceOrderPaperCopy",
        entityId: row.id,
        meta: {
          serviceOrderId: data.serviceOrderId,
          previousStorageKey: existing.storageKey,
          storageKey: data.storageKey,
          contentType: data.contentType,
          fileName: data.fileName ?? null,
          byteSize: data.byteSize,
        } satisfies Prisma.InputJsonValue,
      },
    });

    return { row, previousStorageKey: existing.storageKey };
  });
}


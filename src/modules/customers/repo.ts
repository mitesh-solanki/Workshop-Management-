import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const customerSelect = {
  id: true,
  garageId: true,
  name: true,
  phone: true,
  address: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} as const;

const vehicleSummarySelect = {
  id: true,
  registrationNumber: true,
  make: true,
  model: true,
  stateCode: true,
  year: true,
  odometer: true,
} as const;

export async function createCustomer(
  garageId: string,
  data: {
    name: string;
    phone: string;
    address: string | null;
    notes: string | null;
  },
) {
  return prisma.customer.create({
    data: {
      garageId,
      name: data.name,
      phone: data.phone,
      address: data.address,
      notes: data.notes,
    },
    select: customerSelect,
  });
}

export async function updateCustomerById(
  garageId: string,
  customerId: string,
  data: {
    name: string;
    phone: string;
    address: string | null;
    notes: string | null;
  },
) {
  const result = await prisma.customer.updateMany({
    where: { id: customerId, garageId },
    data: {
      name: data.name,
      phone: data.phone,
      address: data.address,
      notes: data.notes,
    },
  });

  if (result.count === 0) {
    return null;
  }

  return findCustomerById(garageId, customerId);
}

export async function findCustomerById(garageId: string, customerId: string) {
  return prisma.customer.findFirst({
    where: { id: customerId, garageId },
    select: {
      ...customerSelect,
      vehicles: {
        select: {
          ...vehicleSummarySelect,
          insuranceExpiry: true,
          pucExpiry: true,
          fitnessExpiry: true,
        },
        orderBy: { registrationNumber: "asc" },
      },
    },
  });
}

export async function countCustomerServiceOrders(
  garageId: string,
  customerId: string,
) {
  return prisma.serviceOrder.count({
    where: { garageId, customerId },
  });
}

/** Deletes a customer scoped to the garage. Vehicles cascade via Prisma. */
export async function deleteCustomerById(
  garageId: string,
  customerId: string,
  data: { actorId: string; name: string; phone: string },
) {
  return prisma.$transaction(async (tx) => {
    const result = await tx.customer.deleteMany({
      where: { id: customerId, garageId },
    });

    if (result.count === 0) {
      return null;
    }

    await tx.auditLog.create({
      data: {
        garageId,
        actorId: data.actorId,
        action: "customer.deleted",
        entity: "Customer",
        entityId: customerId,
        meta: {
          name: data.name,
          phone: data.phone,
        } satisfies Prisma.InputJsonValue,
      },
    });

    return { id: customerId };
  });
}

function customerSearchWhere(garageId: string, q: string | undefined) {
  const query = q?.trim();
  return {
    garageId,
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { phone: { contains: query } },
            {
              vehicles: {
                some: {
                  registrationNumber: {
                    contains: query.replace(/\s+/g, "").toUpperCase(),
                    mode: "insensitive" as const,
                  },
                },
              },
            },
          ],
        }
      : {}),
  };
}

export async function searchCustomers(
  garageId: string,
  q: string | undefined,
  page: number,
  pageSize: number,
) {
  const where = customerSearchWhere(garageId, q);
  const skip = (page - 1) * pageSize;

  const [items, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      select: {
        ...customerSelect,
        vehicles: {
          select: vehicleSummarySelect,
          orderBy: { registrationNumber: "asc" },
        },
      },
      orderBy: [{ name: "asc" }, { createdAt: "desc" }],
      skip,
      take: pageSize,
    }),
    prisma.customer.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

/** Unpaginated customer rows for CSV export (capped). */
export async function listCustomersForExport(
  garageId: string,
  q: string | undefined,
) {
  return prisma.customer.findMany({
    where: customerSearchWhere(garageId, q),
    select: customerSelect,
    orderBy: [{ name: "asc" }, { createdAt: "desc" }],
    take: 20_000,
  });
}

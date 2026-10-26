import "server-only";

import { Prisma } from "@prisma/client";
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

function customerOrderBy(sort: "newest" | "updated") {
  if (sort === "updated") {
    return [{ updatedAt: "desc" as const }, { name: "asc" as const }];
  }
  return [{ createdAt: "desc" as const }, { name: "asc" as const }];
}

/** Match search filter in SQL so name sorts can use LOWER(name) (case-insensitive). */
function customerSearchSql(garageId: string, q: string | undefined) {
  const query = q?.trim();
  if (!query) {
    return Prisma.sql`c."garageId" = ${garageId}`;
  }
  const registrationNeedle = `%${query.replace(/\s+/g, "").toUpperCase()}%`;
  const textNeedle = `%${query}%`;
  return Prisma.sql`
    c."garageId" = ${garageId}
    AND (
      c.name ILIKE ${textNeedle}
      OR c.phone LIKE ${textNeedle}
      OR EXISTS (
        SELECT 1 FROM "Vehicle" v
        WHERE v."customerId" = c.id
          AND v."garageId" = ${garageId}
          AND UPPER(REPLACE(v."registrationNumber", ' ', '')) LIKE ${registrationNeedle}
      )
    )
  `;
}

async function listCustomerIdsByName(
  garageId: string,
  q: string | undefined,
  direction: "asc" | "desc",
  skip: number,
  take: number,
) {
  const whereSql = customerSearchSql(garageId, q);
  const orderSql =
    direction === "desc"
      ? Prisma.sql`LOWER(c.name) DESC, c."createdAt" DESC`
      : Prisma.sql`LOWER(c.name) ASC, c."createdAt" DESC`;

  return prisma.$queryRaw<{ id: string }[]>`
    SELECT c.id
    FROM "Customer" c
    WHERE ${whereSql}
    ORDER BY ${orderSql}
    LIMIT ${take} OFFSET ${skip}
  `;
}

export async function searchCustomers(
  garageId: string,
  q: string | undefined,
  page: number,
  pageSize: number,
  sort: "newest" | "updated" | "name_asc" | "name_desc" = "newest",
) {
  const where = customerSearchWhere(garageId, q);
  const skip = (page - 1) * pageSize;

  if (sort === "name_asc" || sort === "name_desc") {
    const [idRows, total] = await Promise.all([
      listCustomerIdsByName(
        garageId,
        q,
        sort === "name_desc" ? "desc" : "asc",
        skip,
        pageSize,
      ),
      prisma.customer.count({ where }),
    ]);
    const ids = idRows.map((row) => row.id);
    if (ids.length === 0) {
      return { items: [], total, page, pageSize };
    }

    const unordered = await prisma.customer.findMany({
      where: { garageId, id: { in: ids } },
      select: {
        ...customerSelect,
        vehicles: {
          select: vehicleSummarySelect,
          orderBy: { registrationNumber: "asc" },
        },
      },
    });
    const byId = new Map(unordered.map((item) => [item.id, item]));
    const items = ids
      .map((id) => byId.get(id))
      .filter((item): item is NonNullable<typeof item> => item != null);

    return { items, total, page, pageSize };
  }

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
      orderBy: customerOrderBy(sort),
      skip,
      take: pageSize,
    }),
    prisma.customer.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

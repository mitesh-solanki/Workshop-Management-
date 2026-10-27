import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { BaySort } from "@/modules/bays/schema";

const baySelect = {
  id: true,
  name: true,
  active: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} as const;

function bayOrderBy(sort: BaySort): Prisma.BayOrderByWithRelationInput[] {
  switch (sort) {
    case "name_asc":
      return [{ name: "asc" }];
    case "newest":
      return [{ createdAt: "desc" }];
    case "sort_asc":
    default:
      return [{ createdAt: "desc" }];
  }
}

export async function searchBays(
  garageId: string,
  q: string | undefined,
  page: number,
  pageSize: number,
  sort: BaySort,
) {
  const where: Prisma.BayWhereInput = {
    garageId,
    ...(q
      ? {
          name: { contains: q, mode: "insensitive" },
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.bay.count({ where }),
    prisma.bay.findMany({
      where,
      orderBy: bayOrderBy(sort),
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: baySelect,
    }),
  ]);

  return { items, total, page, pageSize };
}

/**
 * Jobs currently occupying a bay: Inspection or In Progress only.
 * Waiting / Waiting for Parts / Ready / Completed do not hold the bay.
 */
export async function countOpenOrdersByBayName(
  garageId: string,
  bayNames: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const name of bayNames) {
    counts.set(name.toLowerCase(), 0);
  }
  if (bayNames.length === 0) {
    return counts;
  }

  const orders = await prisma.serviceOrder.findMany({
    where: {
      garageId,
      status: { in: ["INSPECTION", "IN_PROGRESS"] },
      bay: { not: null },
    },
    select: { bay: true },
  });

  for (const order of orders) {
    if (!order.bay) continue;
    const key = order.bay.trim().toLowerCase();
    if (!counts.has(key)) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

export async function listActiveBaysForSelect(garageId: string) {
  return prisma.bay.findMany({
    where: { garageId, active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
    },
  });
}

export async function findBayNameInGarage(
  garageId: string,
  name: string,
  excludeBayId?: string,
): Promise<string | null> {
  const existing = await prisma.bay.findFirst({
    where: {
      garageId,
      name: { equals: name, mode: "insensitive" },
      ...(excludeBayId ? { id: { not: excludeBayId } } : {}),
    },
    select: { name: true },
  });
  return existing?.name ?? null;
}

export async function getNextBaySortOrder(garageId: string): Promise<number> {
  const last = await prisma.bay.findFirst({
    where: { garageId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  return (last?.sortOrder ?? 0) + 1;
}

export async function createBay(
  garageId: string,
  data: {
    name: string;
    actorId: string;
    sortOrder: number;
  },
) {
  return prisma.$transaction(async (tx) => {
    const bay = await tx.bay.create({
      data: {
        garageId,
        name: data.name,
        active: true,
        sortOrder: data.sortOrder,
      },
      select: baySelect,
    });

    await tx.auditLog.create({
      data: {
        garageId,
        actorId: data.actorId,
        action: "bay.created",
        entity: "Bay",
        entityId: bay.id,
        meta: { name: bay.name } satisfies Prisma.InputJsonValue,
      },
    });

    return bay;
  });
}

export async function findBayById(garageId: string, bayId: string) {
  return prisma.bay.findFirst({
    where: { id: bayId, garageId },
    select: baySelect,
  });
}

export async function updateBayById(
  garageId: string,
  bayId: string,
  data: {
    name: string;
    actorId: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    const result = await tx.bay.updateMany({
      where: { id: bayId, garageId },
      data: { name: data.name },
    });
    if (result.count === 0) {
      return null;
    }

    await tx.auditLog.create({
      data: {
        garageId,
        actorId: data.actorId,
        action: "bay.updated",
        entity: "Bay",
        entityId: bayId,
        meta: { name: data.name } satisfies Prisma.InputJsonValue,
      },
    });

    return tx.bay.findFirst({
      where: { id: bayId, garageId },
      select: baySelect,
    });
  });
}

export async function deleteBayById(
  garageId: string,
  bayId: string,
  data: { actorId: string; name: string },
) {
  return prisma.$transaction(async (tx) => {
    const result = await tx.bay.deleteMany({
      where: { id: bayId, garageId },
    });
    if (result.count === 0) {
      return false;
    }

    await tx.auditLog.create({
      data: {
        garageId,
        actorId: data.actorId,
        action: "bay.deleted",
        entity: "Bay",
        entityId: bayId,
        meta: { name: data.name } satisfies Prisma.InputJsonValue,
      },
    });

    return true;
  });
}

import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const vehicleSelect = {
  id: true,
  garageId: true,
  customerId: true,
  registrationNumber: true,
  make: true,
  model: true,
  stateCode: true,
  year: true,
  odometer: true,
  insuranceExpiry: true,
  pucExpiry: true,
  fitnessExpiry: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function findVehicleById(garageId: string, vehicleId: string) {
  return prisma.vehicle.findFirst({
    where: { id: vehicleId, garageId },
    select: {
      ...vehicleSelect,
      customer: {
        select: {
          id: true,
          name: true,
          phone: true,
        },
      },
    },
  });
}

export async function findVehicleByRegistration(
  garageId: string,
  registrationNumber: string,
) {
  return prisma.vehicle.findFirst({
    where: { garageId, registrationNumber },
    select: vehicleSelect,
  });
}

export async function listVehiclesByCustomerId(
  garageId: string,
  customerId: string,
) {
  return prisma.vehicle.findMany({
    where: { garageId, customerId },
    select: vehicleSelect,
    orderBy: { registrationNumber: "asc" },
    take: 500,
  });
}

function vehicleSearchWhere(garageId: string, q: string | undefined) {
  const query = q?.trim();
  const regQuery = query ? query.replace(/\s+/g, "").toUpperCase() : undefined;
  return {
    garageId,
    ...(query
      ? {
          OR: [
            {
              registrationNumber: {
                contains: regQuery,
                mode: "insensitive" as const,
              },
            },
            { make: { contains: query, mode: "insensitive" as const } },
            { model: { contains: query, mode: "insensitive" as const } },
            {
              customer: {
                OR: [
                  { name: { contains: query, mode: "insensitive" as const } },
                  { phone: { contains: query } },
                ],
              },
            },
          ],
        }
      : {}),
  };
}

function vehicleOrderBy(sort: "newest" | "oldest" | "updated") {
  if (sort === "updated") {
    return [
      { updatedAt: "desc" as const },
      { registrationNumber: "asc" as const },
    ];
  }
  if (sort === "oldest") {
    return [
      { createdAt: "asc" as const },
      { registrationNumber: "asc" as const },
    ];
  }
  return [
    { createdAt: "desc" as const },
    { registrationNumber: "asc" as const },
  ];
}

function vehicleSearchSql(garageId: string, q: string | undefined) {
  const query = q?.trim();
  if (!query) {
    return Prisma.sql`v."garageId" = ${garageId}`;
  }
  const regQuery = `%${query.replace(/\s+/g, "").toUpperCase()}%`;
  const textNeedle = `%${query}%`;
  return Prisma.sql`
    v."garageId" = ${garageId}
    AND (
      UPPER(REPLACE(v."registrationNumber", ' ', '')) LIKE ${regQuery}
      OR v.make ILIKE ${textNeedle}
      OR v.model ILIKE ${textNeedle}
      OR EXISTS (
        SELECT 1 FROM "Customer" c
        WHERE c.id = v."customerId"
          AND c."garageId" = ${garageId}
          AND (
            c.name ILIKE ${textNeedle}
            OR c.phone LIKE ${textNeedle}
          )
      )
    )
  `;
}

async function listVehicleIdsByRegistration(
  garageId: string,
  q: string | undefined,
  direction: "asc" | "desc",
  skip: number,
  take: number,
) {
  const whereSql = vehicleSearchSql(garageId, q);
  const orderSql =
    direction === "desc"
      ? Prisma.sql`LOWER(v."registrationNumber") DESC, v."createdAt" DESC`
      : Prisma.sql`LOWER(v."registrationNumber") ASC, v."createdAt" DESC`;

  return prisma.$queryRaw<{ id: string }[]>`
    SELECT v.id
    FROM "Vehicle" v
    WHERE ${whereSql}
    ORDER BY ${orderSql}
    LIMIT ${take} OFFSET ${skip}
  `;
}

export async function searchVehicles(
  garageId: string,
  q: string | undefined,
  page: number,
  pageSize: number,
  sort:
    | "newest"
    | "oldest"
    | "updated"
    | "name_asc"
    | "name_desc" = "newest",
) {
  const where = vehicleSearchWhere(garageId, q);
  const skip = (page - 1) * pageSize;

  if (sort === "name_asc" || sort === "name_desc") {
    const [idRows, total] = await Promise.all([
      listVehicleIdsByRegistration(
        garageId,
        q,
        sort === "name_desc" ? "desc" : "asc",
        skip,
        pageSize,
      ),
      prisma.vehicle.count({ where }),
    ]);
    const ids = idRows.map((row) => row.id);
    if (ids.length === 0) {
      return { items: [], total, page, pageSize };
    }

    const unordered = await prisma.vehicle.findMany({
      where: { garageId, id: { in: ids } },
      select: {
        ...vehicleSelect,
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
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
    prisma.vehicle.findMany({
      where,
      select: {
        ...vehicleSelect,
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
      orderBy: vehicleOrderBy(
        sort === "updated" || sort === "oldest" ? sort : "newest",
      ),
      skip,
      take: pageSize,
    }),
    prisma.vehicle.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

export async function createVehicle(
  garageId: string,
  data: {
    customerId: string;
    registrationNumber: string;
    make: string;
    model: string;
    stateCode: string;
    year: number | null;
    odometer: number | null;
    insuranceExpiry: Date | null;
    pucExpiry: Date | null;
    fitnessExpiry: Date | null;
  },
) {
  return prisma.vehicle.create({
    data: {
      garageId,
      customerId: data.customerId,
      registrationNumber: data.registrationNumber,
      make: data.make,
      model: data.model,
      stateCode: data.stateCode,
      year: data.year,
      odometer: data.odometer,
      insuranceExpiry: data.insuranceExpiry,
      pucExpiry: data.pucExpiry,
      fitnessExpiry: data.fitnessExpiry,
    },
    select: vehicleSelect,
  });
}

export async function updateVehicleById(
  garageId: string,
  vehicleId: string,
  data: {
    registrationNumber: string;
    make: string;
    model: string;
    stateCode: string;
    year: number | null;
    odometer: number | null;
    insuranceExpiry: Date | null;
    pucExpiry: Date | null;
    fitnessExpiry: Date | null;
  },
) {
  try {
    const result = await prisma.vehicle.updateMany({
      where: { id: vehicleId, garageId },
      data: {
        registrationNumber: data.registrationNumber,
        make: data.make,
        model: data.model,
        stateCode: data.stateCode,
        year: data.year,
        odometer: data.odometer,
        insuranceExpiry: data.insuranceExpiry,
        pucExpiry: data.pucExpiry,
        fitnessExpiry: data.fitnessExpiry,
      },
    });

    if (result.count === 0) {
      return null;
    }

    return findVehicleById(garageId, vehicleId);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw error;
    }
    throw error;
  }
}

export function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function countVehicleServiceOrders(
  garageId: string,
  vehicleId: string,
) {
  return prisma.serviceOrder.count({
    where: { garageId, vehicleId },
  });
}

export async function deleteVehicleById(
  garageId: string,
  vehicleId: string,
  data: {
    actorId: string;
    customerId: string;
    registrationNumber: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    const result = await tx.vehicle.deleteMany({
      where: { id: vehicleId, garageId },
    });

    if (result.count === 0) {
      return null;
    }

    await tx.auditLog.create({
      data: {
        garageId,
        actorId: data.actorId,
        action: "vehicle.deleted",
        entity: "Vehicle",
        entityId: vehicleId,
        meta: {
          customerId: data.customerId,
          registrationNumber: data.registrationNumber,
        } satisfies Prisma.InputJsonValue,
      },
    });

    return { id: vehicleId, customerId: data.customerId };
  });
}

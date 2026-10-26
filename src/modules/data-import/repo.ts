import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type {
  ValidatedCustomerRow,
  ValidatedPartRow,
  ValidatedVehicleRow,
} from "@/modules/data-import/validate";
import { normalisePhoneKey } from "@/modules/data-import/validate";

/** Match by normalised phone (spaces stripped) in memory. */
export async function listCustomerPhoneIndex(garageId: string) {
  const customers = await prisma.customer.findMany({
    where: { garageId },
    select: { id: true, phone: true },
    take: 20_000,
  });
  const map = new Map<string, string>();
  for (const c of customers) {
    map.set(normalisePhoneKey(c.phone), c.id);
  }
  return map;
}

export async function listRegistrationSet(
  garageId: string,
): Promise<Set<string>> {
  const vehicles = await prisma.vehicle.findMany({
    where: { garageId },
    select: { registrationNumber: true },
    take: 20_000,
  });
  return new Set(vehicles.map((v) => v.registrationNumber));
}

export async function listSkuSet(garageId: string): Promise<Set<string>> {
  const parts = await prisma.part.findMany({
    where: { garageId },
    select: { sku: true },
    take: 20_000,
  });
  return new Set(
    parts
      .map((p) => p.sku)
      .filter((sku): sku is string => sku != null && sku.length > 0),
  );
}

export async function importCustomersBatch(
  garageId: string,
  actorId: string,
  rows: ValidatedCustomerRow[],
) {
  return prisma.$transaction(async (tx) => {
    const created: string[] = [];
    for (const row of rows) {
      const customer = await tx.customer.create({
        data: {
          garageId,
          name: row.name,
          phone: row.phone,
          address: row.address,
          notes: row.notes,
        },
        select: { id: true },
      });
      created.push(customer.id);
    }

    await tx.auditLog.create({
      data: {
        garageId,
        actorId,
        action: "import.customers_completed",
        entity: "Import",
        meta: {
          entity: "customers",
          importedCount: created.length,
        } satisfies Prisma.InputJsonValue,
      },
    });

    return { importedCount: created.length, ids: created };
  });
}

export async function importVehiclesBatch(
  garageId: string,
  actorId: string,
  rows: ValidatedVehicleRow[],
) {
  return prisma.$transaction(async (tx) => {
    const created: string[] = [];
    for (const row of rows) {
      const vehicle = await tx.vehicle.create({
        data: {
          garageId,
          customerId: row.customerId,
          registrationNumber: row.registrationNumber,
          make: row.make,
          model: row.model,
          year: row.year,
          odometer: row.odometer,
          insuranceExpiry: row.insuranceExpiry,
          pucExpiry: row.pucExpiry,
          fitnessExpiry: row.fitnessExpiry,
        },
        select: { id: true },
      });
      created.push(vehicle.id);
    }

    await tx.auditLog.create({
      data: {
        garageId,
        actorId,
        action: "import.vehicles_completed",
        entity: "Import",
        meta: {
          entity: "vehicles",
          importedCount: created.length,
        } satisfies Prisma.InputJsonValue,
      },
    });

    return { importedCount: created.length, ids: created };
  });
}

export async function importPartsBatch(
  garageId: string,
  actorId: string,
  rows: ValidatedPartRow[],
) {
  return prisma.$transaction(async (tx) => {
    const created: string[] = [];
    for (const row of rows) {
      const part = await tx.part.create({
        data: {
          garageId,
          name: row.name,
          sku: row.sku,
          unit: row.unit,
          purchasePricePaise: row.purchasePricePaise,
          sellingPricePaise: row.sellingPricePaise,
          gstRatePercent: row.gstRatePercent,
          hsn: row.hsn,
          lowStockLevel: row.lowStockLevel,
        },
        select: { id: true },
      });

      if (row.openingStock > 0) {
        await tx.stockMovement.create({
          data: {
            garageId,
            partId: part.id,
            type: "IN",
            quantityChange: row.openingStock,
            note: "Opening stock (import)",
            createdById: actorId,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          garageId,
          actorId,
          action: "inventory.part_created",
          entity: "Part",
          entityId: part.id,
          meta: {
            name: row.name,
            sku: row.sku,
            openingStock: row.openingStock,
            source: "import",
          } satisfies Prisma.InputJsonValue,
        },
      });

      created.push(part.id);
    }

    await tx.auditLog.create({
      data: {
        garageId,
        actorId,
        action: "import.parts_completed",
        entity: "Import",
        meta: {
          entity: "parts",
          importedCount: created.length,
        } satisfies Prisma.InputJsonValue,
      },
    });

    return { importedCount: created.length, ids: created };
  });
}

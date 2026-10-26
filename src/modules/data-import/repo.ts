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

/** Uppercase SKU → part id (SKU stored normalised on write). */
export async function listSkuIndex(garageId: string) {
  const parts = await prisma.part.findMany({
    where: { garageId },
    select: { id: true, sku: true },
    take: 20_000,
  });
  const map = new Map<string, string>();
  for (const part of parts) {
    if (part.sku) {
      map.set(part.sku, part.id);
    }
  }
  return map;
}

export async function importCustomersBatch(
  garageId: string,
  actorId: string,
  rows: ValidatedCustomerRow[],
) {
  return prisma.$transaction(async (tx) => {
    const ids: string[] = [];
    let createdCount = 0;
    let updatedCount = 0;

    for (const row of rows) {
      if (row.existingCustomerId) {
        const updated = await tx.customer.updateMany({
          where: { id: row.existingCustomerId, garageId },
          data: {
            name: row.name,
            phone: row.phone,
            address: row.address,
            notes: row.notes,
          },
        });
        if (updated.count === 0) {
          throw new Error("import.customer_update_failed");
        }
        await tx.auditLog.create({
          data: {
            garageId,
            actorId,
            action: "customer.updated",
            entity: "Customer",
            entityId: row.existingCustomerId,
            meta: {
              name: row.name,
              phone: row.phone,
              source: "import",
            } satisfies Prisma.InputJsonValue,
          },
        });
        ids.push(row.existingCustomerId);
        updatedCount += 1;
        continue;
      }

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
      ids.push(customer.id);
      createdCount += 1;
    }

    await tx.auditLog.create({
      data: {
        garageId,
        actorId,
        action: "import.customers_completed",
        entity: "Import",
        meta: {
          entity: "customers",
          importedCount: ids.length,
          createdCount,
          updatedCount,
        } satisfies Prisma.InputJsonValue,
      },
    });

    return {
      importedCount: ids.length,
      createdCount,
      updatedCount,
      ids,
    };
  });
}

export async function importVehiclesBatch(
  garageId: string,
  actorId: string,
  rows: ValidatedVehicleRow[],
) {
  return prisma.$transaction(async (tx) => {
    const created: string[] = [];
    const customersCreatedByPhone = new Map<string, string>();
    let customersCreated = 0;

    for (const row of rows) {
      let customerId = row.customerId;
      if (!customerId && row.customerCreate) {
        const phoneKey = normalisePhoneKey(row.customerCreate.phone);
        const already = customersCreatedByPhone.get(phoneKey);
        if (already) {
          customerId = already;
        } else {
          const customer = await tx.customer.create({
            data: {
              garageId,
              name: row.customerCreate.name,
              phone: row.customerCreate.phone,
              address: row.customerCreate.address,
              notes: row.customerCreate.notes,
            },
            select: { id: true },
          });
          customerId = customer.id;
          customersCreatedByPhone.set(phoneKey, customer.id);
          customersCreated += 1;
          await tx.auditLog.create({
            data: {
              garageId,
              actorId,
              action: "customer.created",
              entity: "Customer",
              entityId: customer.id,
              meta: {
                name: row.customerCreate.name,
                phone: row.customerCreate.phone,
                source: "vehicle_import",
              } satisfies Prisma.InputJsonValue,
            },
          });
        }
      }

      if (!customerId) {
        throw new Error("import.vehicle_missing_customer");
      }

      const vehicle = await tx.vehicle.create({
        data: {
          garageId,
          customerId,
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
          customersCreated,
        } satisfies Prisma.InputJsonValue,
      },
    });

    return { importedCount: created.length, ids: created, customersCreated };
  });
}

export async function importPartsBatch(
  garageId: string,
  actorId: string,
  rows: ValidatedPartRow[],
) {
  return prisma.$transaction(async (tx) => {
    const ids: string[] = [];
    let createdCount = 0;
    let updatedCount = 0;

    for (const row of rows) {
      if (row.existingPartId) {
        const updated = await tx.part.updateMany({
          where: { id: row.existingPartId, garageId },
          data: {
            name: row.name,
            sku: row.sku,
            unit: row.unit,
            purchasePricePaise: row.purchasePricePaise,
            sellingPricePaise: row.sellingPricePaise,
            gstRatePercent: row.gstRatePercent,
            hsn: row.hsn,
            lowStockLevel: row.lowStockLevel,
          },
        });
        if (updated.count === 0) {
          throw new Error("import.part_update_failed");
        }
        await tx.auditLog.create({
          data: {
            garageId,
            actorId,
            action: "inventory.part_updated",
            entity: "Part",
            entityId: row.existingPartId,
            meta: {
              name: row.name,
              sku: row.sku,
              source: "import",
            } satisfies Prisma.InputJsonValue,
          },
        });
        ids.push(row.existingPartId);
        updatedCount += 1;
        continue;
      }

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

      ids.push(part.id);
      createdCount += 1;
    }

    await tx.auditLog.create({
      data: {
        garageId,
        actorId,
        action: "import.parts_completed",
        entity: "Import",
        meta: {
          entity: "parts",
          importedCount: ids.length,
          createdCount,
          updatedCount,
        } satisfies Prisma.InputJsonValue,
      },
    });

    return {
      importedCount: ids.length,
      createdCount,
      updatedCount,
      ids,
    };
  });
}

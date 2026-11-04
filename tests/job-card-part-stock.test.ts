/**
 * Postgres proofs: stock OUT when a part is added on the job card,
 * IN when removed / qty reduced, and insufficient stock is rejected.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { getPartStock } from "@/modules/inventory/repo";
import {
  createServiceOrderLine,
  deleteServiceOrderLine,
  updateServiceOrderLine,
} from "@/modules/service-orders/repo";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    "postgresql://workshop:workshop@localhost:5433/workshop?schema=public";
}

const prisma = new PrismaClient();

async function dbReachable(): Promise<boolean> {
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("db timeout")), 3000),
      ),
    ]);
    return true;
  } catch {
    return false;
  }
}

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

describe("job card part stock", () => {
  let garageId = "";
  let userId = "";
  let partId = "";
  let orderId = "";
  let ready = false;

  beforeAll(async () => {
    ready = await dbReachable();
    if (!ready) {
      return;
    }

    const garage = await prisma.garage.create({
      data: { name: `JC stock ${suffix}` },
      select: { id: true },
    });
    garageId = garage.id;

    const user = await prisma.user.create({
      data: {
        email: `jc-stock-${suffix}@example.com`,
        name: "JC Stock",
        role: "OWNER",
        garageId,
      },
      select: { id: true },
    });
    userId = user.id;

    const customer = await prisma.customer.create({
      data: { garageId, name: "Cust", phone: "9111111111" },
      select: { id: true },
    });

    const vehicle = await prisma.vehicle.create({
      data: {
        garageId,
        customerId: customer.id,
        registrationNumber: `GJ01JC${suffix.slice(-4)}`.toUpperCase(),
        make: "Maruti",
        model: "Swift",
        stateCode: "24",
      },
      select: { id: true },
    });

    const part = await prisma.part.create({
      data: {
        garageId,
        name: "Oil Filter",
        sku: `OF-${suffix}`.toUpperCase().slice(0, 64),
        unit: "pcs",
        purchasePricePaise: 5_000,
        sellingPricePaise: 8_000,
        gstRatePercent: 18,
        hsn: "84212300",
        lowStockLevel: 0,
      },
      select: { id: true },
    });
    partId = part.id;

    await prisma.stockMovement.create({
      data: {
        garageId,
        partId,
        type: "IN",
        quantityChange: 3,
        note: "seed",
        createdById: userId,
      },
    });

    const order = await prisma.serviceOrder.create({
      data: {
        garageId,
        customerId: customer.id,
        vehicleId: vehicle.id,
        jobCardNumber: 1,
        status: "IN_PROGRESS",
        complaint: "Service",
      },
      select: { id: true },
    });
    orderId = order.id;
  });

  afterAll(async () => {
    if (!ready) {
      return;
    }
    await prisma.garage.deleteMany({ where: { id: garageId } });
    await prisma.$disconnect();
  });

  it("OUTs stock on add, adjusts on qty change, INs on remove", async () => {
    if (!ready) {
      return;
    }

    expect(await getPartStock(garageId, partId)).toBe(3);

    const created = await createServiceOrderLine(garageId, {
      serviceOrderId: orderId,
      type: "PART",
      description: "Oil Filter",
      quantity: 2,
      unitPricePaise: 8_000,
      partId,
      actorId: userId,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    expect(await getPartStock(garageId, partId)).toBe(1);

    const up = await updateServiceOrderLine(garageId, {
      lineId: created.line.id,
      serviceOrderId: orderId,
      description: "Oil Filter",
      quantity: 3,
      unitPricePaise: 8_000,
      actorId: userId,
    });
    expect(up.ok).toBe(true);
    expect(await getPartStock(garageId, partId)).toBe(0);

    const down = await updateServiceOrderLine(garageId, {
      lineId: created.line.id,
      serviceOrderId: orderId,
      description: "Oil Filter",
      quantity: 1,
      unitPricePaise: 8_000,
      actorId: userId,
    });
    expect(down.ok).toBe(true);
    expect(await getPartStock(garageId, partId)).toBe(2);

    expect(
      await deleteServiceOrderLine(garageId, {
        lineId: created.line.id,
        serviceOrderId: orderId,
        actorId: userId,
      }),
    ).toEqual({ ok: true });
    expect(await getPartStock(garageId, partId)).toBe(3);
  });

  it("rejects add when stock is insufficient", async () => {
    if (!ready) {
      return;
    }

    const result = await createServiceOrderLine(garageId, {
      serviceOrderId: orderId,
      type: "PART",
      description: "Oil Filter",
      quantity: 10,
      unitPricePaise: 8_000,
      partId,
      actorId: userId,
    });
    expect(result).toEqual({
      ok: false,
      reason: "INSUFFICIENT_STOCK",
      partName: "Oil Filter",
    });
    expect(await getPartStock(garageId, partId)).toBe(3);
  });

  it("rejects qty increase when stock is insufficient", async () => {
    if (!ready) {
      return;
    }

    const created = await createServiceOrderLine(garageId, {
      serviceOrderId: orderId,
      type: "PART",
      description: "Oil Filter",
      quantity: 1,
      unitPricePaise: 8_000,
      partId,
      actorId: userId,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    expect(await getPartStock(garageId, partId)).toBe(2);

    const fail = await updateServiceOrderLine(garageId, {
      lineId: created.line.id,
      serviceOrderId: orderId,
      description: "Oil Filter",
      quantity: 10,
      unitPricePaise: 8_000,
      actorId: userId,
    });
    expect(fail).toEqual({
      ok: false,
      reason: "INSUFFICIENT_STOCK",
      partName: "Oil Filter",
    });
    expect(await getPartStock(garageId, partId)).toBe(2);

    await deleteServiceOrderLine(garageId, {
      lineId: created.line.id,
      serviceOrderId: orderId,
      actorId: userId,
    });
    expect(await getPartStock(garageId, partId)).toBe(3);
  });
});

/**
 * Live Postgres proofs for stock rules (FOR UPDATE; stock never below zero).
 * Requires DATABASE_URL (defaults to local docker-compose on host port 5433).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    "postgresql://workshop:workshop@localhost:5433/workshop?schema=public";
}

const prisma = new PrismaClient();

async function dbReachable(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

describe("inventory stock against Postgres", () => {
  let garageId = "";
  let userId = "";
  let partId = "";
  let ready = false;

  beforeAll(async () => {
    ready = await dbReachable();
    if (!ready) {
      return;
    }

    const garage = await prisma.garage.create({
      data: {
        name: `Stock test garage ${suffix}` },
      select: { id: true } });
    garageId = garage.id;

    const user = await prisma.user.create({
      data: {
        email: `stock-test-${suffix}@example.com`,
        name: "Stock Tester",
        role: "OWNER",
        garageId },
      select: { id: true } });
    userId = user.id;

    const part = await prisma.part.create({
      data: {
        garageId,
        name: "Filter",
        sku: `STK-${suffix}`.toUpperCase().slice(0, 64),
        unit: "pcs",
        purchasePricePaise: 10000,
        sellingPricePaise: 15000,
        gstRatePercent: 18,
        hsn: "87089900",
        lowStockLevel: 2 },
      select: { id: true } });
    partId = part.id;

    await prisma.stockMovement.create({
      data: {
        garageId,
        partId,
        type: "IN",
        quantityChange: 10,
        note: "seed",
        createdById: userId } });
  }, 30_000);

  afterAll(async () => {
    if (garageId) {
      await prisma.garage.delete({ where: { id: garageId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  it("rejects OUT that would go negative", async () => {
    if (!ready) {
      throw new Error(
        "Postgres not reachable — start docker compose and set DATABASE_URL",
      );
    }

    const { applyStockMovement, getPartStock } = await import(
      "@/modules/inventory/repo"
    );

    const before = await getPartStock(garageId, partId);
    expect(before).toBe(10);

    const blocked = await applyStockMovement(garageId, {
      partId,
      type: "OUT",
      quantity: 11,
      note: "too many",
      actorId: userId,
    });

    expect(blocked).toMatchObject({
      ok: false,
      reason: "INSUFFICIENT_STOCK",
    });
    expect(await getPartStock(garageId, partId)).toBe(10);
  });

  it("serializes concurrent OUTs so stock is not oversold", async () => {
    if (!ready) {
      throw new Error(
        "Postgres not reachable — start docker compose and set DATABASE_URL",
      );
    }

    const { applyStockMovement, getPartStock } = await import(
      "@/modules/inventory/repo"
    );

    const current = await getPartStock(garageId, partId);
    if (current !== 10) {
      const delta = 10 - current;
      if (delta > 0) {
        await applyStockMovement(garageId, {
          partId,
          type: "IN",
          quantity: delta,
          note: "reset for concurrency",
          actorId: userId,
        });
      } else if (delta < 0) {
        await applyStockMovement(garageId, {
          partId,
          type: "OUT",
          quantity: -delta,
          note: "reset for concurrency",
          actorId: userId,
        });
      }
    }
    expect(await getPartStock(garageId, partId)).toBe(10);

    const [a, b] = await Promise.all([
      applyStockMovement(garageId, {
        partId,
        type: "OUT",
        quantity: 6,
        note: "race-a",
        actorId: userId }),
      applyStockMovement(garageId, {
        partId,
        type: "OUT",
        quantity: 6,
        note: "race-b",
        actorId: userId }),
    ]);

    const successes = [a, b].filter((r) => r.ok);
    const failures = [a, b].filter((r) => !r.ok);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({
      ok: false,
      reason: "INSUFFICIENT_STOCK" });
    expect(await getPartStock(garageId, partId)).toBe(4);
  });
});

/**
 * Live Postgres proof: vendor create/update write AuditLog rows.
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

describe("vendor audit against Postgres", () => {
  let garageId = "";
  let userId = "";
  let ready = false;

  beforeAll(async () => {
    ready = await dbReachable();
    if (!ready) return;

    const garage = await prisma.garage.create({
      data: { name: `Vendor audit ${suffix}`, allowNegativeStock: false },
      select: { id: true },
    });
    garageId = garage.id;

    const user = await prisma.user.create({
      data: {
        email: `vendor-audit-${suffix}@example.com`,
        name: "Vendor Auditor",
        role: "OWNER",
        garageId,
      },
      select: { id: true },
    });
    userId = user.id;
  }, 30_000);

  afterAll(async () => {
    if (garageId) {
      await prisma.garage.delete({ where: { id: garageId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  function requireDb() {
    if (!ready) {
      throw new Error(
        "Postgres not reachable — start docker compose and set DATABASE_URL",
      );
    }
  }

  it("writes audit log on vendor create and update", async () => {
    requireDb();
    const { createVendor, updateVendorById } = await import(
      "@/modules/vendors/repo"
    );

    const vendor = await createVendor(garageId, {
      name: `Audited Vendor ${suffix}`,
      phone: "9876543210",
      email: null,
      address: null,
      gstin: null,
      notes: null,
      actorId: userId,
    });

    const created = await prisma.auditLog.findFirst({
      where: {
        garageId,
        entity: "Vendor",
        entityId: vendor.id,
        action: "vendor.created",
      },
    });
    expect(created).not.toBeNull();
    expect(created?.actorId).toBe(userId);

    await updateVendorById(garageId, vendor.id, {
      name: `Audited Vendor Updated ${suffix}`,
      phone: "9876543210",
      email: null,
      address: null,
      gstin: null,
      notes: "updated",
      actorId: userId,
    });

    const updated = await prisma.auditLog.findFirst({
      where: {
        garageId,
        entity: "Vendor",
        entityId: vendor.id,
        action: "vendor.updated",
      },
    });
    expect(updated).not.toBeNull();
    expect(updated?.actorId).toBe(userId);
  });
});

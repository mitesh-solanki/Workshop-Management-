/**
 * Postgres proofs for inspection-linked estimates:
 * - create without job card
 * - revision keeps prior row (superseded)
 * - garage isolation on lookups
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import type { RoleSession } from "@/lib/rbac";
import {
  createEstimateFromInspection,
  createInspectionEstimateRevision,
  getEstimateForInspection,
} from "@/modules/estimates/service";
import {
  findCurrentEstimateForInspection,
  listEstimatesForInspection,
} from "@/modules/estimates/repo";

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

describe("inspection estimates against Postgres", () => {
  let garageId = "";
  let otherGarageId = "";
  let userId = "";
  let customerId = "";
  let vehicleId = "";
  let inspectionId = "";
  let ready = false;

  beforeAll(async () => {
    ready = await dbReachable();
    if (!ready) return;

    const garage = await prisma.garage.create({
      data: { name: `Insp Est ${suffix}` },
      select: { id: true },
    });
    garageId = garage.id;

    const other = await prisma.garage.create({
      data: { name: `Insp Est other ${suffix}` },
      select: { id: true },
    });
    otherGarageId = other.id;

    const user = await prisma.user.create({
      data: {
        email: `insp-est-${suffix}@example.com`,
        name: "Inspection Estimate Tester",
        role: "OWNER",
        garageId,
      },
      select: { id: true },
    });
    userId = user.id;

    const customer = await prisma.customer.create({
      data: { garageId, name: "Insp Est Cust", phone: "9444444444" },
      select: { id: true },
    });
    customerId = customer.id;

    const vehicle = await prisma.vehicle.create({
      data: {
        garageId,
        customerId,
        registrationNumber: `GJ01E${suffix.slice(-4)}`.toUpperCase(),
        make: "Hyundai",
        model: "i20",
        stateCode: "24",
      },
      select: { id: true },
    });
    vehicleId = vehicle.id;

    const inspection = await prisma.inspection.create({
      data: {
        garageId,
        customerId,
        vehicleId,
        complaint: "Noise",
        items: {
          create: [
            {
              garageId,
              key: "brakes",
              label: "Front brake pads",
              quantity: 1,
              unitPricePaise: 75_000,
              sortOrder: 0,
              isCustom: true,
            },
          ],
        },
      },
      select: { id: true },
    });
    inspectionId = inspection.id;
  });

  afterAll(async () => {
    if (!ready) return;
    await prisma.garage.deleteMany({
      where: { id: { in: [garageId, otherGarageId] } },
    });
    await prisma.$disconnect();
  });

  it("creates an estimate on the inspection, revises with history, and isolates by garage", async () => {
    if (!ready) return;

    const session: RoleSession = {
      userId,
      garageId,
      role: "OWNER",
    };

    const created = await createEstimateFromInspection(session, inspectionId, {
      notes: "First quote",
    });

    expect(created.serviceOrderId).toBeNull();
    expect(created.inspectionId).toBe(inspectionId);
    expect(created.revisionNumber).toBe(1);
    expect(created.lines).toHaveLength(1);
    expect(created.lines[0]?.description).toBe("Front brake pads");

    const revision = await createInspectionEstimateRevision(
      session,
      inspectionId,
      { notes: "Updated after customer agree" },
    );

    expect(revision.revisionNumber).toBe(2);
    expect(revision.inspectionId).toBe(inspectionId);
    expect(revision.serviceOrderId).toBeNull();

    const current = await findCurrentEstimateForInspection(
      garageId,
      inspectionId,
    );
    expect(current?.id).toBe(revision.id);
    expect(current?.supersededAt).toBeNull();

    const history = await listEstimatesForInspection(garageId, inspectionId);
    expect(history).toHaveLength(2);
    const superseded = history.find((row) => row.id === created.id);
    expect(superseded?.supersededAt).not.toBeNull();

    const otherCurrent = await findCurrentEstimateForInspection(
      otherGarageId,
      inspectionId,
    );
    expect(otherCurrent).toBeNull();

    const otherHistory = await listEstimatesForInspection(
      otherGarageId,
      inspectionId,
    );
    expect(otherHistory).toHaveLength(0);

    const bundle = await getEstimateForInspection(session, inspectionId);
    expect(bundle.current?.id).toBe(revision.id);
    expect(bundle.revisions).toHaveLength(2);
  });
});

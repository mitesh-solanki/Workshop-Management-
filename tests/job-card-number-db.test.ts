/**
 * Live Postgres proofs for Job Card number allocation.
 * Requires DATABASE_URL (defaults to local docker-compose on host port 5433).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  createServiceOrder,
  getNextJobCardNumber,
  JobCardNumberConflictError,
  setNextJobCardNumberSeed,
  updateServiceOrderDetails,
} from "@/modules/service-orders/repo";

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

describe("job card numbers against Postgres", () => {
  let garageId = "";
  let otherGarageId = "";
  let userId = "";
  let customerId = "";
  let vehicleId = "";
  let ready = false;

  beforeAll(async () => {
    ready = await dbReachable();
    if (!ready) {
      return;
    }

    const garage = await prisma.garage.create({
      data: { name: `Job number garage ${suffix}` },
      select: { id: true },
    });
    garageId = garage.id;

    const other = await prisma.garage.create({
      data: { name: `Job number other ${suffix}` },
      select: { id: true },
    });
    otherGarageId = other.id;

    const user = await prisma.user.create({
      data: {
        email: `job-number-${suffix}@example.com`,
        name: "Number Tester",
        role: "OWNER",
        garageId,
      },
      select: { id: true },
    });
    userId = user.id;

    const customer = await prisma.customer.create({
      data: {
        garageId,
        name: "Number Customer",
        phone: "9988776655",
      },
      select: { id: true },
    });
    customerId = customer.id;

    const vehicle = await prisma.vehicle.create({
      data: {
        garageId,
        customerId,
        registrationNumber: `JN${suffix.slice(-6)}`.toUpperCase(),
        make: "Tata",
        model: "Nexon",
      },
      select: { id: true },
    });
    vehicleId = vehicle.id;
  });

  afterAll(async () => {
    if (garageId || otherGarageId) {
      await prisma.garage.deleteMany({
        where: { id: { in: [garageId, otherGarageId].filter(Boolean) } },
      });
    }
    await prisma.$disconnect();
  });

  it("suggests 1 for a fresh garage and advances after create", async () => {
    if (!ready) return;

    expect(await getNextJobCardNumber(garageId)).toBe(1);

    await createServiceOrder(garageId, {
      vehicleId,
      customerId,
      jobCardNumber: 255,
      complaint: "Jump start",
      requestedServices: null,
      odometerIn: null,
      expectedCompletion: null,
      technicianIds: [],
      bay: null,
      priority: "NORMAL",
      status: "IN_PROGRESS",
      actorId: userId,
    });

    expect(await getNextJobCardNumber(garageId)).toBe(256);

    await createServiceOrder(garageId, {
      vehicleId,
      customerId,
      jobCardNumber: 300,
      complaint: "Jump ahead",
      requestedServices: null,
      odometerIn: null,
      expectedCompletion: null,
      technicianIds: [],
      bay: null,
      priority: "NORMAL",
      status: "IN_PROGRESS",
      actorId: userId,
    });

    expect(await getNextJobCardNumber(garageId)).toBe(301);
  });

  it("allows filling a gap and editing to an unused number", async () => {
    if (!ready) return;

    const gap = await createServiceOrder(garageId, {
      vehicleId,
      customerId,
      jobCardNumber: 256,
      complaint: "Fill gap",
      requestedServices: null,
      odometerIn: null,
      expectedCompletion: null,
      technicianIds: [],
      bay: null,
      priority: "NORMAL",
      status: "IN_PROGRESS",
      actorId: userId,
    });

    expect(await getNextJobCardNumber(garageId)).toBe(301);

    const updated = await updateServiceOrderDetails(garageId, gap.id, {
      jobCardNumber: 290,
      complaint: "Fill gap",
      requestedServices: null,
      odometerIn: null,
      expectedCompletion: null,
      technicianIds: [],
      bay: null,
      priority: "NORMAL",
      vehicleId,
      actorId: userId,
    });
    expect(updated?.jobCardNumber).toBe(290);
    expect(await getNextJobCardNumber(garageId)).toBe(301);
  });

  it("rejects duplicate numbers and too-low settings seed", async () => {
    if (!ready) return;

    await expect(
      createServiceOrder(garageId, {
        vehicleId,
        customerId,
        jobCardNumber: 300,
        complaint: "Dup",
        requestedServices: null,
        odometerIn: null,
        expectedCompletion: null,
        technicianIds: [],
        bay: null,
        priority: "NORMAL",
        status: "IN_PROGRESS",
        actorId: userId,
      }),
    ).rejects.toBeInstanceOf(JobCardNumberConflictError);

    await expect(setNextJobCardNumberSeed(garageId, 200)).rejects.toThrow(
      "JOB_CARD_NUMBER_SEED_TOO_LOW",
    );

    expect(await setNextJobCardNumberSeed(garageId, 500)).toBe(500);
    expect(await getNextJobCardNumber(garageId)).toBe(500);
  });

  it("isolates numbers per garage", async () => {
    if (!ready) return;

    expect(await getNextJobCardNumber(otherGarageId)).toBe(1);
    await setNextJobCardNumberSeed(otherGarageId, 10);
    expect(await getNextJobCardNumber(otherGarageId)).toBe(10);
    expect(await getNextJobCardNumber(garageId)).toBe(500);
  });
});

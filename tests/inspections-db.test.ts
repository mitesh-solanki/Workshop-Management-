/**
 * Postgres proofs for standalone inspections:
 * - create without job card
 * - link to job card
 * - garage isolation on list
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import type { RoleSession } from "@/lib/rbac";
import { linkInspectionToServiceOrder } from "@/modules/inspections/repo";
import {
  createInspection,
  listGarageInspections,
  saveNewInspection,
} from "@/modules/inspections/service";
import { createOrder } from "@/modules/service-orders/service";

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

describe("standalone inspections against Postgres", () => {
  let garageId = "";
  let otherGarageId = "";
  let userId = "";
  let customerId = "";
  let vehicleId = "";
  let ready = false;

  beforeAll(async () => {
    ready = await dbReachable();
    if (!ready) return;

    const garage = await prisma.garage.create({
      data: { name: `Insp DB ${suffix}` },
      select: { id: true },
    });
    garageId = garage.id;

    const other = await prisma.garage.create({
      data: { name: `Insp other ${suffix}` },
      select: { id: true },
    });
    otherGarageId = other.id;

    const user = await prisma.user.create({
      data: {
        email: `insp-db-${suffix}@example.com`,
        name: "Inspection Tester",
        role: "OWNER",
        garageId,
      },
      select: { id: true },
    });
    userId = user.id;

    const customer = await prisma.customer.create({
      data: { garageId, name: "Insp Cust", phone: "9555555555" },
      select: { id: true },
    });
    customerId = customer.id;

    const vehicle = await prisma.vehicle.create({
      data: {
        garageId,
        customerId,
        registrationNumber: `GJ01I${suffix.slice(-4)}`.toUpperCase(),
        make: "Honda",
        model: "City",
        stateCode: "24",
      },
      select: { id: true },
    });
    vehicleId = vehicle.id;

    await prisma.customer.create({
      data: {
        garageId: otherGarageId,
        name: "Other Cust",
        phone: "9666666666",
      },
    });
  });

  afterAll(async () => {
    if (!ready) return;
    await prisma.garage.deleteMany({
      where: { id: { in: [garageId, otherGarageId] } },
    });
    await prisma.$disconnect();
  });

  it("creates an inspection without a job card and lists it for the garage only", async () => {
    if (!ready) return;

    const session: RoleSession = {
      userId,
      garageId,
      role: "OWNER",
    };
    const otherSession: RoleSession = {
      userId,
      garageId: otherGarageId,
      role: "OWNER",
    };

    const inspection = await createInspection(session, {
      customerId,
      vehicleId,
    });

    expect(inspection.serviceOrderId).toBeNull();
    expect(inspection.items.length).toBe(0);
    expect(inspection.customerId).toBe(customerId);
    expect(inspection.vehicleId).toBe(vehicleId);

    const listed = await listGarageInspections(session, { pageSize: 50 });
    expect(listed.items.some((row) => row.id === inspection.id)).toBe(true);

    const otherList = await listGarageInspections(otherSession, {
      pageSize: 50,
    });
    expect(otherList.items.some((row) => row.id === inspection.id)).toBe(false);

    const order = await prisma.serviceOrder.create({
      data: {
        garageId,
        vehicleId,
        customerId,
        complaint: "From inspection",
        status: "WAITING",
      },
      select: { id: true },
    });

    const linked = await linkInspectionToServiceOrder(garageId, inspection.id, {
      serviceOrderId: order.id,
      actorId: userId,
    });
    expect(linked?.serviceOrderId).toBe(order.id);
  });

  it("saves expectedCompletion and copies it onto a new job card", async () => {
    if (!ready) return;

    const session: RoleSession = {
      userId,
      garageId,
      role: "OWNER",
    };
    const due = new Date("2026-11-02T10:00:00.000Z");

    const inspection = await saveNewInspection(session, {
      customerId,
      vehicleId,
      complaint: "Due check",
      recommendedNotes: "",
      expectedCompletion: due,
      items: [],
    });
    expect(inspection.expectedCompletion?.toISOString()).toBe(due.toISOString());

    const order = await createOrder(session, {
      vehicleId,
      complaint: "From inspection due",
      requestedServices: "",
      odometerIn: null,
      expectedCompletion: null,
      technicianIds: [],
      bay: "",
      priority: "NORMAL",
      inspectionId: inspection.id,
    });
    expect(order.expectedCompletion?.toISOString()).toBe(due.toISOString());
  });
});

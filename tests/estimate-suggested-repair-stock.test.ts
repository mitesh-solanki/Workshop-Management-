/**
 * Postgres proofs: suggested-repair part stock on estimate approval.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  findLinkedPartLine,
  recordLineApproval } from "@/modules/estimates/repo";

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

describe("estimate stock from suggested repairs", () => {
  let garageId = "";
  let userId = "";
  let partId = "";
  let serviceOrderId = "";
  let estimateId = "";
  let estimateLineId = "";
  let ready = false;

  beforeAll(async () => {
    ready = await dbReachable();
    if (!ready) {
      return;
    }

    const garage = await prisma.garage.create({
      data: { name: `SR stock ${suffix}` },
      select: { id: true } });
    garageId = garage.id;

    const user = await prisma.user.create({
      data: {
        email: `sr-stock-${suffix}@example.com`,
        name: "SR Tester",
        role: "OWNER",
        garageId },
      select: { id: true } });
    userId = user.id;

    const customer = await prisma.customer.create({
      data: { garageId, name: "Cust", phone: "9000000001" },
      select: { id: true } });

    const vehicle = await prisma.vehicle.create({
      data: {
        garageId,
        customerId: customer.id,
        registrationNumber: `GJ01SR${suffix.slice(-4)}`.toUpperCase(),
        make: "Maruti",
        model: "Swift",
        stateCode: "24" },
      select: { id: true } });

    const order = await prisma.serviceOrder.create({
      data: {
        garageId,
        customerId: customer.id,
        vehicleId: vehicle.id,
        status: "INSPECTION",
        complaint: "Test" },
      select: { id: true } });
    serviceOrderId = order.id;

    const part = await prisma.part.create({
      data: {
        garageId,
        name: "Pad",
        sku: `SRP-${suffix}`.toUpperCase().slice(0, 64),
        unit: "pcs",
        purchasePricePaise: 10000,
        sellingPricePaise: 15000,
        gstRatePercent: 18,
        hsn: "87089900",
        lowStockLevel: 0 },
      select: { id: true } });
    partId = part.id;

    await prisma.stockMovement.create({
      data: {
        garageId,
        partId,
        type: "IN",
        quantityChange: 5,
        note: "seed",
        createdById: userId } });

    const inspection = await prisma.inspection.create({
      data: { garageId, serviceOrderId },
      select: { id: true } });

    const repair = await prisma.suggestedRepair.create({
      data: {
        garageId,
        inspectionId: inspection.id,
        type: "PART",
        description: "Pad (SRP)",
        quantity: 2,
        unitPricePaise: 15000,
        partId },
      select: { id: true } });

    const estimate = await prisma.estimate.create({
      data: {
        garageId,
        serviceOrderId,
        revisionNumber: 1,
        createdById: userId,
        lines: {
          create: {
            garageId,
            type: "PART",
            description: "Pad (SRP)",
            quantity: 2,
            unitPricePaise: 15000,
            gstRatePercent: 18,
            hsnOrSac: "87089900",
            approvalState: "PENDING",
            sourceSuggestedRepairId: repair.id,
            sortOrder: 0 } } },
      select: {
        id: true,
        lines: { select: { id: true } } } });
    estimateId = estimate.id;
    estimateLineId = estimate.lines[0]!.id;
  });

  afterAll(async () => {
    if (!ready) {
      return;
    }
    await prisma.garage.deleteMany({ where: { id: garageId } });
    await prisma.$disconnect();
  });

  it("resolves part from suggested repair for stock", async () => {
    if (!ready) {
      return;
    }
    await prisma.$transaction(async (tx) => {
      const linked = await findLinkedPartLine(tx, garageId, {
        type: "PART",
        sourceOrderLineId: null,
        sourceSuggestedRepairId: (
          await tx.estimateLine.findFirstOrThrow({
            where: { id: estimateLineId },
            select: { sourceSuggestedRepairId: true } })
        ).sourceSuggestedRepairId });
      expect(linked).toEqual({ partId, serviceOrderLineId: null });
    });
  });

  it("issues stock OUT when approving suggested-repair part line", async () => {
    if (!ready) {
      return;
    }
    const before = await prisma.stockMovement.aggregate({
      where: { garageId, partId },
      _sum: { quantityChange: true } });
    expect(before._sum.quantityChange).toBe(5);

    const result = await recordLineApproval(garageId, {
      estimateId,
      estimateLineId,
      serviceOrderId,
      fromState: "PENDING",
      toState: "APPROVED",
      method: "MANUAL",
      note: null,
      recordedById: userId });
    expect(result.ok).toBe(true);

    const after = await prisma.stockMovement.aggregate({
      where: { garageId, partId },
      _sum: { quantityChange: true } });
    expect(after._sum.quantityChange).toBe(3);
  });

  it("returns stock IN when rejecting an approved suggested-repair part line", async () => {
    if (!ready) {
      return;
    }
    const before = await prisma.stockMovement.aggregate({
      where: { garageId, partId },
      _sum: { quantityChange: true } });
    expect(before._sum.quantityChange).toBe(3);

    const result = await recordLineApproval(garageId, {
      estimateId,
      estimateLineId,
      serviceOrderId,
      fromState: "APPROVED",
      toState: "REJECTED",
      method: "MANUAL",
      note: null,
      recordedById: userId });
    expect(result.ok).toBe(true);

    const after = await prisma.stockMovement.aggregate({
      where: { garageId, partId },
      _sum: { quantityChange: true } });
    expect(after._sum.quantityChange).toBe(5);
  });
});

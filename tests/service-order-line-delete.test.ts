/**
 * Postgres proofs for every delete path around a job card:
 * - delete labour / part on job card (free, pending, approved, rejected)
 * - approved-on-current-estimate block; superseded estimate does not block
 * - delete estimate line (pending / approved → stock back / billed)
 * - approved qty change adjusts stock
 * - delete whole job card restores held stock
 * - NOT_FOUND / wrong garage
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  deleteEstimateLine,
  recordLineApproval,
  updateEstimateLineDetails,
} from "@/modules/estimates/repo";
import { getPartStock } from "@/modules/inventory/repo";
import {
  createServiceOrderLine,
  deleteServiceOrderById,
  deleteServiceOrderLine,
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

describe("job card delete matrix", () => {
  let garageId = "";
  let otherGarageId = "";
  let userId = "";
  let customerId = "";
  let vehicleId = "";
  let partId = "";
  let orderId = "";
  let ready = false;

  beforeAll(async () => {
    ready = await dbReachable();
    if (!ready) return;

    const garage = await prisma.garage.create({
      data: { name: `Del matrix ${suffix}`, allowNegativeStock: false },
      select: { id: true },
    });
    garageId = garage.id;

    const other = await prisma.garage.create({
      data: { name: `Del other ${suffix}`, allowNegativeStock: false },
      select: { id: true },
    });
    otherGarageId = other.id;

    const user = await prisma.user.create({
      data: {
        email: `del-matrix-${suffix}@example.com`,
        name: "Del Matrix",
        role: "OWNER",
        garageId,
      },
      select: { id: true },
    });
    userId = user.id;

    const customer = await prisma.customer.create({
      data: { garageId, name: "Cust", phone: "9333333333" },
      select: { id: true },
    });
    customerId = customer.id;

    const vehicle = await prisma.vehicle.create({
      data: {
        garageId,
        customerId,
        registrationNumber: `GJ01DX${suffix.slice(-4)}`.toUpperCase(),
        make: "Maruti",
        model: "Swift",
        stateCode: "24",
      },
      select: { id: true },
    });
    vehicleId = vehicle.id;

    const part = await prisma.part.create({
      data: {
        garageId,
        name: "Brake Pad",
        sku: `BP-${suffix}`.toUpperCase().slice(0, 64),
        unit: "set",
        purchasePricePaise: 20_000,
        sellingPricePaise: 32_000,
        gstRatePercent: 18,
        hsn: "87083000",
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
        quantityChange: 5,
        note: "seed",
        createdById: userId,
      },
    });

    const order = await prisma.serviceOrder.create({
      data: {
        garageId,
        customerId,
        vehicleId,
        status: "IN_PROGRESS",
        complaint: "Brakes",
      },
      select: { id: true },
    });
    orderId = order.id;
  });

  afterAll(async () => {
    if (!ready) return;
    await prisma.garage.deleteMany({
      where: { id: { in: [garageId, otherGarageId] } },
    });
    await prisma.$disconnect();
  });

  it("deletes free labour and free part with no stock change", async () => {
    if (!ready) return;

    const before = await getPartStock(garageId, partId);

    const labour = await createServiceOrderLine(garageId, {
      serviceOrderId: orderId,
      type: "LABOUR",
      description: "Pad fitting",
      quantity: 1,
      unitPricePaise: 4_000,
      partId: null,
      actorId: userId,
    });
    expect(labour.ok).toBe(true);
    if (!labour.ok) return;

    const partLine = await createServiceOrderLine(garageId, {
      serviceOrderId: orderId,
      type: "PART",
      description: "Brake Pad",
      quantity: 1,
      unitPricePaise: 32_000,
      partId,
      actorId: userId,
    });
    expect(partLine.ok).toBe(true);
    if (!partLine.ok) return;

    expect(
      await deleteServiceOrderLine(garageId, {
        lineId: labour.line.id,
        serviceOrderId: orderId,
        actorId: userId,
      }),
    ).toEqual({ ok: true });

    expect(
      await deleteServiceOrderLine(garageId, {
        lineId: partLine.line.id,
        serviceOrderId: orderId,
        actorId: userId,
      }),
    ).toEqual({ ok: true });

    expect(await getPartStock(garageId, partId)).toBe(before);

    expect(
      await deleteServiceOrderLine(garageId, {
        lineId: partLine.line.id,
        serviceOrderId: orderId,
        actorId: userId,
      }),
    ).toEqual({ ok: false, reason: "NOT_FOUND" });

    expect(
      await deleteServiceOrderLine(otherGarageId, {
        lineId: "anything",
        serviceOrderId: orderId,
        actorId: userId,
      }),
    ).toEqual({ ok: false, reason: "NOT_FOUND" });
  });

  it("allows delete of pending estimate-linked part; blocks only while APPROVED", async () => {
    if (!ready) return;

    const partLine = await createServiceOrderLine(garageId, {
      serviceOrderId: orderId,
      type: "PART",
      description: "Brake Pad",
      quantity: 1,
      unitPricePaise: 32_000,
      partId,
      actorId: userId,
    });
    expect(partLine.ok).toBe(true);
    if (!partLine.ok) return;

    const labourLine = await createServiceOrderLine(garageId, {
      serviceOrderId: orderId,
      type: "LABOUR",
      description: "Fitting",
      quantity: 1,
      unitPricePaise: 4_000,
      partId: null,
      actorId: userId,
    });
    expect(labourLine.ok).toBe(true);
    if (!labourLine.ok) return;

    const estimate = await prisma.estimate.create({
      data: {
        garageId,
        serviceOrderId: orderId,
        revisionNumber: 1,
        createdById: userId,
        lines: {
          create: [
            {
              garageId,
              type: "PART",
              description: "Brake Pad",
              quantity: 1,
              unitPricePaise: 32_000,
              gstRatePercent: 18,
              hsnOrSac: "87083000",
              approvalState: "PENDING",
              sourceOrderLineId: partLine.line.id,
              sortOrder: 0,
            },
            {
              garageId,
              type: "LABOUR",
              description: "Fitting",
              quantity: 1,
              unitPricePaise: 4_000,
              gstRatePercent: 18,
              hsnOrSac: "998714",
              approvalState: "PENDING",
              sourceOrderLineId: labourLine.line.id,
              sortOrder: 1,
            },
          ],
        },
      },
      select: {
        id: true,
        lines: { select: { id: true, type: true } },
      },
    });
    const estPartId = estimate.lines.find((l) => l.type === "PART")!.id;
    const estLabourId = estimate.lines.find((l) => l.type === "LABOUR")!.id;

    // Pending: job-card part can still be deleted (guard is APPROVED only).
    // Keep this line for approval tests — prove with a disposable pending part.
    const disposable = await createServiceOrderLine(garageId, {
      serviceOrderId: orderId,
      type: "PART",
      description: "Disposable pending",
      quantity: 1,
      unitPricePaise: 1_000,
      partId,
      actorId: userId,
    });
    expect(disposable.ok).toBe(true);
    if (!disposable.ok) return;

    await prisma.estimateLine.create({
      data: {
        garageId,
        estimateId: estimate.id,
        type: "PART",
        description: "Disposable pending",
        quantity: 1,
        unitPricePaise: 1_000,
        gstRatePercent: 18,
        hsnOrSac: "87083000",
        approvalState: "PENDING",
        sourceOrderLineId: disposable.line.id,
        sortOrder: 2,
      },
    });

    expect(
      await deleteServiceOrderLine(garageId, {
        lineId: disposable.line.id,
        serviceOrderId: orderId,
        actorId: userId,
      }),
    ).toEqual({ ok: true });
    expect(await getPartStock(garageId, partId)).toBe(5);

    const agreed = await recordLineApproval(garageId, {
      estimateId: estimate.id,
      estimateLineId: estPartId,
      serviceOrderId: orderId,
      fromState: "PENDING",
      toState: "APPROVED",
      method: "MANUAL",
      note: null,
      recordedById: userId,
    });
    expect(agreed.ok).toBe(true);
    expect(await getPartStock(garageId, partId)).toBe(4);

    expect(
      await deleteServiceOrderLine(garageId, {
        lineId: partLine.line.id,
        serviceOrderId: orderId,
        actorId: userId,
      }),
    ).toEqual({ ok: false, reason: "APPROVED_ON_ESTIMATE" });

    // Labour job-card line is not blocked by estimate approval.
    expect(
      await deleteServiceOrderLine(garageId, {
        lineId: labourLine.line.id,
        serviceOrderId: orderId,
        actorId: userId,
      }),
    ).toEqual({ ok: true });

    // Qty increase on approved estimate issues more stock.
    const qtyUp = await updateEstimateLineDetails(garageId, {
      lineId: estPartId,
      estimateId: estimate.id,
      serviceOrderId: orderId,
      description: "Brake Pad",
      quantity: 2,
      unitPricePaise: 32_000,
      actorId: userId,
    });
    expect(qtyUp).not.toBeNull();
    expect(await getPartStock(garageId, partId)).toBe(3);

    // Qty decrease returns stock.
    const qtyDown = await updateEstimateLineDetails(garageId, {
      lineId: estPartId,
      estimateId: estimate.id,
      serviceOrderId: orderId,
      description: "Brake Pad",
      quantity: 1,
      unitPricePaise: 32_000,
      actorId: userId,
    });
    expect(qtyDown).not.toBeNull();
    expect(await getPartStock(garageId, partId)).toBe(4);

    // Delete approved estimate labour line — no stock effect.
    expect(
      await deleteEstimateLine(garageId, {
        lineId: estLabourId,
        estimateId: estimate.id,
        serviceOrderId: orderId,
        description: "Fitting",
        actorId: userId,
      }),
    ).toBe("ok");

    // Delete approved estimate PART line — returns stock, then job-card part deletable.
    expect(
      await deleteEstimateLine(garageId, {
        lineId: estPartId,
        estimateId: estimate.id,
        serviceOrderId: orderId,
        description: "Brake Pad",
        actorId: userId,
      }),
    ).toBe("ok");
    expect(await getPartStock(garageId, partId)).toBe(5);

    expect(
      await deleteServiceOrderLine(garageId, {
        lineId: partLine.line.id,
        serviceOrderId: orderId,
        actorId: userId,
      }),
    ).toEqual({ ok: true });
  });

  it("Disagree unlocks job-card delete; superseded approved estimate does not block", async () => {
    if (!ready) return;

    const partLine = await createServiceOrderLine(garageId, {
      serviceOrderId: orderId,
      type: "PART",
      description: "Brake Pad",
      quantity: 1,
      unitPricePaise: 32_000,
      partId,
      actorId: userId,
    });
    expect(partLine.ok).toBe(true);
    if (!partLine.ok) return;

    const estimate = await prisma.estimate.create({
      data: {
        garageId,
        serviceOrderId: orderId,
        revisionNumber: 2,
        createdById: userId,
        lines: {
          create: {
            garageId,
            type: "PART",
            description: "Brake Pad",
            quantity: 1,
            unitPricePaise: 32_000,
            gstRatePercent: 18,
            hsnOrSac: "87083000",
            approvalState: "PENDING",
            sourceOrderLineId: partLine.line.id,
            sortOrder: 0,
          },
        },
      },
      select: { id: true, lines: { select: { id: true } } },
    });
    const estLineId = estimate.lines[0]!.id;

    await recordLineApproval(garageId, {
      estimateId: estimate.id,
      estimateLineId: estLineId,
      serviceOrderId: orderId,
      fromState: "PENDING",
      toState: "APPROVED",
      method: "MANUAL",
      note: null,
      recordedById: userId,
    });
    expect(await getPartStock(garageId, partId)).toBe(4);

    expect(
      await deleteServiceOrderLine(garageId, {
        lineId: partLine.line.id,
        serviceOrderId: orderId,
        actorId: userId,
      }),
    ).toEqual({ ok: false, reason: "APPROVED_ON_ESTIMATE" });

    await recordLineApproval(garageId, {
      estimateId: estimate.id,
      estimateLineId: estLineId,
      serviceOrderId: orderId,
      fromState: "APPROVED",
      toState: "REJECTED",
      method: "MANUAL",
      note: "Disagree",
      recordedById: userId,
    });
    expect(await getPartStock(garageId, partId)).toBe(5);

    expect(
      await deleteServiceOrderLine(garageId, {
        lineId: partLine.line.id,
        serviceOrderId: orderId,
        actorId: userId,
      }),
    ).toEqual({ ok: true });

    // Superseded approved estimate must not block delete on a new job-card part.
    const part2 = await createServiceOrderLine(garageId, {
      serviceOrderId: orderId,
      type: "PART",
      description: "Brake Pad",
      quantity: 1,
      unitPricePaise: 32_000,
      partId,
      actorId: userId,
    });
    expect(part2.ok).toBe(true);
    if (!part2.ok) return;

    const oldEst = await prisma.estimate.create({
      data: {
        garageId,
        serviceOrderId: orderId,
        revisionNumber: 3,
        supersededAt: new Date(),
        createdById: userId,
        lines: {
          create: {
            garageId,
            type: "PART",
            description: "Brake Pad",
            quantity: 1,
            unitPricePaise: 32_000,
            gstRatePercent: 18,
            hsnOrSac: "87083000",
            approvalState: "APPROVED",
            sourceOrderLineId: part2.line.id,
            sortOrder: 0,
          },
        },
      },
    });
    expect(oldEst.id).toBeTruthy();

    expect(
      await deleteServiceOrderLine(garageId, {
        lineId: part2.line.id,
        serviceOrderId: orderId,
        actorId: userId,
      }),
    ).toEqual({ ok: true });
    expect(await getPartStock(garageId, partId)).toBe(5);
  });

  it("blocks deleting a billed estimate line; pending estimate delete leaves stock", async () => {
    if (!ready) return;

    const partLine = await createServiceOrderLine(garageId, {
      serviceOrderId: orderId,
      type: "PART",
      description: "Brake Pad",
      quantity: 1,
      unitPricePaise: 32_000,
      partId,
      actorId: userId,
    });
    expect(partLine.ok).toBe(true);
    if (!partLine.ok) return;

    const estimate = await prisma.estimate.create({
      data: {
        garageId,
        serviceOrderId: orderId,
        revisionNumber: 4,
        createdById: userId,
        lines: {
          create: {
            garageId,
            type: "PART",
            description: "Brake Pad",
            quantity: 1,
            unitPricePaise: 32_000,
            gstRatePercent: 18,
            hsnOrSac: "87083000",
            approvalState: "PENDING",
            sourceOrderLineId: partLine.line.id,
            sortOrder: 0,
          },
        },
      },
      select: { id: true, lines: { select: { id: true } } },
    });
    const estLineId = estimate.lines[0]!.id;

    expect(
      await deleteEstimateLine(garageId, {
        lineId: estLineId,
        estimateId: estimate.id,
        serviceOrderId: orderId,
        description: "Brake Pad",
        actorId: userId,
      }),
    ).toBe("ok");
    expect(await getPartStock(garageId, partId)).toBe(5);

    // Recreate estimate line and mark billed via invoice line.
    const est2 = await prisma.estimate.create({
      data: {
        garageId,
        serviceOrderId: orderId,
        revisionNumber: 5,
        createdById: userId,
        lines: {
          create: {
            garageId,
            type: "PART",
            description: "Brake Pad",
            quantity: 1,
            unitPricePaise: 32_000,
            gstRatePercent: 18,
            hsnOrSac: "87083000",
            approvalState: "PENDING",
            sourceOrderLineId: partLine.line.id,
            sortOrder: 0,
          },
        },
      },
      select: { id: true, lines: { select: { id: true } } },
    });
    const billedLineId = est2.lines[0]!.id;

    const agree = await recordLineApproval(garageId, {
      estimateId: est2.id,
      estimateLineId: billedLineId,
      serviceOrderId: orderId,
      fromState: "PENDING",
      toState: "APPROVED",
      method: "MANUAL",
      note: null,
      recordedById: userId,
    });
    expect(agree.ok).toBe(true);
    expect(await getPartStock(garageId, partId)).toBe(4);

    const invoice = await prisma.invoice.create({
      data: {
        garageId,
        serviceOrderId: orderId,
        estimateId: est2.id,
        customerId,
        status: "DRAFT",
        sellerStateCode: "24",
        placeOfSupplyStateCode: "24",
        gstSplit: "CGST_SGST",
        taxablePaise: 32_000,
        cgstPaise: 2_880,
        sgstPaise: 2_880,
        igstPaise: 0,
        totalPaise: 37_760,
        lines: {
          create: {
            garageId,
            estimateLineId: billedLineId,
            type: "PART",
            description: "Brake Pad",
            quantity: 1,
            unitPricePaise: 32_000,
            gstRatePercent: 18,
            hsnOrSac: "87083000",
            taxablePaise: 32_000,
            cgstPaise: 2_880,
            sgstPaise: 2_880,
            igstPaise: 0,
            totalPaise: 37_760,
            sortOrder: 0,
          },
        },
      },
      select: { id: true },
    });
    expect(invoice.id).toBeTruthy();

    expect(
      await deleteEstimateLine(garageId, {
        lineId: billedLineId,
        estimateId: est2.id,
        serviceOrderId: orderId,
        description: "Brake Pad",
        actorId: userId,
      }),
    ).toBe("billed");
    expect(await getPartStock(garageId, partId)).toBe(4);

    // Cleanup invoice so later job-card delete can cascade cleanly.
    await prisma.invoice.delete({ where: { id: invoice.id } });
    await recordLineApproval(garageId, {
      estimateId: est2.id,
      estimateLineId: billedLineId,
      serviceOrderId: orderId,
      fromState: "APPROVED",
      toState: "REJECTED",
      method: "MANUAL",
      note: "cleanup",
      recordedById: userId,
    });
    expect(await getPartStock(garageId, partId)).toBe(5);
    await deleteServiceOrderLine(garageId, {
      lineId: partLine.line.id,
      serviceOrderId: orderId,
      actorId: userId,
    });
  });

  it("deleting the whole job card restores stock still held by Agree", async () => {
    if (!ready) return;

    const order = await prisma.serviceOrder.create({
      data: {
        garageId,
        customerId,
        vehicleId,
        status: "IN_PROGRESS",
        complaint: "Delete me",
      },
      select: { id: true },
    });

    const partLine = await createServiceOrderLine(garageId, {
      serviceOrderId: order.id,
      type: "PART",
      description: "Brake Pad",
      quantity: 2,
      unitPricePaise: 32_000,
      partId,
      actorId: userId,
    });
    expect(partLine.ok).toBe(true);
    if (!partLine.ok) return;

    const estimate = await prisma.estimate.create({
      data: {
        garageId,
        serviceOrderId: order.id,
        revisionNumber: 1,
        createdById: userId,
        lines: {
          create: {
            garageId,
            type: "PART",
            description: "Brake Pad",
            quantity: 2,
            unitPricePaise: 32_000,
            gstRatePercent: 18,
            hsnOrSac: "87083000",
            approvalState: "PENDING",
            sourceOrderLineId: partLine.line.id,
            sortOrder: 0,
          },
        },
      },
      select: { id: true, lines: { select: { id: true } } },
    });

    const agreed = await recordLineApproval(garageId, {
      estimateId: estimate.id,
      estimateLineId: estimate.lines[0]!.id,
      serviceOrderId: order.id,
      fromState: "PENDING",
      toState: "APPROVED",
      method: "MANUAL",
      note: null,
      recordedById: userId,
    });
    expect(agreed.ok).toBe(true);
    expect(await getPartStock(garageId, partId)).toBe(3);

    // Must not be able to delete the held part line while approved.
    expect(
      await deleteServiceOrderLine(garageId, {
        lineId: partLine.line.id,
        serviceOrderId: order.id,
        actorId: userId,
      }),
    ).toEqual({ ok: false, reason: "APPROVED_ON_ESTIMATE" });

    const deleted = await deleteServiceOrderById(garageId, order.id, {
      actorId: userId,
      vehicleId,
      customerId,
      registrationNumber: "DEL",
    });
    expect(deleted).not.toBeNull();
    expect(await getPartStock(garageId, partId)).toBe(5);

    const cross = await deleteServiceOrderById(otherGarageId, orderId, {
      actorId: userId,
      vehicleId,
      customerId,
      registrationNumber: "X",
    });
    expect(cross).toBeNull();
  });
});

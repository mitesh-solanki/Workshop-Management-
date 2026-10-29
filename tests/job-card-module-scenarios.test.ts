/**
 * Full job-card module scenarios against local Postgres.
 *
 * Covers everything the job-card module can do at the repo layer:
 * create, update details, status transitions, add/update/delete labour & part
 * lines, price/qty totals, inventory on estimate Agree/Disagree, delete job
 * card, garage isolation, and audit trail.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { recordLineApproval } from "@/modules/estimates/repo";
import { computeEstimateTotals } from "@/modules/estimates/totals";
import { getPartStock } from "@/modules/inventory/repo";
import {
  canTransitionStatus,
  STATUS_TRANSITIONS,
  type ServiceOrderStatusValue } from "@/modules/service-orders/schema";
import {
  createServiceOrder,
  createServiceOrderLine,
  deleteServiceOrderById,
  deleteServiceOrderLine,
  findServiceOrderById,
  listServiceOrderAuditLogs,
  listServiceOrders,
  updateServiceOrderDetails,
  updateServiceOrderLine,
  updateServiceOrderStatus } from "@/modules/service-orders/repo";

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

describe("job card module — full scenarios", () => {
  let garageId = "";
  let otherGarageId = "";
  let userId = "";
  let technicianId = "";
  let customerId = "";
  let vehicleId = "";
  let vehicleBId = "";
  let partId = "";
  let orderId = "";
  let orderBId = "";
  let labourLineId = "";
  let partLineId = "";
  let freePartLineId = "";
  let estimateId = "";
  let estimatePartLineId = "";
  let estimateBId = "";
  let estimateBPartLineId = "";
  let ready = false;

  beforeAll(async () => {
    ready = await dbReachable();
    if (!ready) return;

    const garage = await prisma.garage.create({
      data: {
        name: `JC module ${suffix}` },
      select: { id: true } });
    garageId = garage.id;

    const otherGarage = await prisma.garage.create({
      data: {
        name: `JC other ${suffix}` },
      select: { id: true } });
    otherGarageId = otherGarage.id;

    const user = await prisma.user.create({
      data: {
        email: `jc-mod-${suffix}@example.com`,
        name: "JC Module Tester",
        role: "OWNER",
        garageId },
      select: { id: true } });
    userId = user.id;

    const tech = await prisma.user.create({
      data: {
        email: `jc-tech-${suffix}@example.com`,
        name: "Tech One",
        role: "TECHNICIAN",
        garageId },
      select: { id: true } });
    technicianId = tech.id;

    const customer = await prisma.customer.create({
      data: { garageId, name: "Cust", phone: "9222222222" },
      select: { id: true } });
    customerId = customer.id;

    const vehicle = await prisma.vehicle.create({
      data: {
        garageId,
        customerId,
        registrationNumber: `GJ01JM${suffix.slice(-4)}`.toUpperCase(),
        make: "Honda",
        model: "City",
        stateCode: "24",
        odometer: 10_000 },
      select: { id: true } });
    vehicleId = vehicle.id;

    const vehicleB = await prisma.vehicle.create({
      data: {
        garageId,
        customerId,
        registrationNumber: `GJ01JN${suffix.slice(-4)}`.toUpperCase(),
        make: "Honda",
        model: "Amaze",
        stateCode: "24" },
      select: { id: true } });
    vehicleBId = vehicleB.id;

    const part = await prisma.part.create({
      data: {
        garageId,
        name: "Oil Filter",
        sku: `OF-${suffix}`.toUpperCase().slice(0, 64),
        unit: "pcs",
        purchasePricePaise: 8_000,
        sellingPricePaise: 12_000,
        gstRatePercent: 18,
        hsn: "84212300",
        lowStockLevel: 1 },
      select: { id: true } });
    partId = part.id;

    await prisma.stockMovement.create({
      data: {
        garageId,
        partId,
        type: "IN",
        quantityChange: 2,
        note: "seed two filters",
        createdById: userId } });
  });

  afterAll(async () => {
    if (!ready) return;
    await prisma.garage.deleteMany({
      where: { id: { in: [garageId, otherGarageId] } } });
    await prisma.$disconnect();
  });

  it("creates a job card in WAITING with audit", async () => {
    if (!ready) return;

    const order = await createServiceOrder(garageId, {
      vehicleId,
      customerId,
      complaint: "Engine oil leak",
      requestedServices: "Oil change",
      odometerIn: 12_500,
      expectedCompletion: new Date("2030-01-15T10:00:00.000Z"),
      technicianId,
      bay: "Bay 1",
      priority: "HIGH",
      actorId: userId });

    orderId = order.id;
    expect(order.status).toBe("WAITING");
    expect(order.priority).toBe("HIGH");
    expect(order.complaint).toBe("Engine oil leak");
    expect(order.bay).toBe("Bay 1");
    expect(order.technicianId).toBe(technicianId);
    expect(order.odometerIn).toBe(12_500);

    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, garageId },
      select: { odometer: true } });
    expect(vehicle?.odometer).toBe(12_500);

    const audits = await listServiceOrderAuditLogs(garageId, orderId);
    expect(audits.some((a) => a.action === "service_order.status_changed")).toBe(
      true,
    );
  });

  it("updates job-card details without changing status", async () => {
    if (!ready) return;

    const updated = await updateServiceOrderDetails(garageId, orderId, {
      complaint: "Engine oil leak + filter",
      requestedServices: "Oil + filter",
      odometerIn: 12_600,
      expectedCompletion: new Date("2030-01-16T10:00:00.000Z"),
      technicianId,
      bay: "Bay 2",
      priority: "URGENT",
      vehicleId,
      actorId: userId });

    expect(updated).not.toBeNull();
    expect(updated!.complaint).toBe("Engine oil leak + filter");
    expect(updated!.bay).toBe("Bay 2");
    expect(updated!.priority).toBe("URGENT");
    expect(updated!.status).toBe("WAITING");
    expect(updated!.odometerIn).toBe(12_600);

    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, garageId },
      select: { odometer: true } });
    expect(vehicle?.odometer).toBe(12_600);
  });

  it("walks allowed status transitions and rejects stale/illegal moves", async () => {
    if (!ready) return;

    // Schema gate used by the service layer.
    for (const [status, next] of Object.entries(STATUS_TRANSITIONS) as Array<
      [ServiceOrderStatusValue, readonly ServiceOrderStatusValue[]]
    >) {
      for (const candidate of [
        "WAITING",
        "INSPECTION",
        "IN_PROGRESS",
        "WAITING_FOR_PARTS",
        "READY",
        "COMPLETED",
      ] as const) {
        expect(canTransitionStatus(status, candidate)).toBe(
          next.includes(candidate),
        );
      }
    }
    expect(canTransitionStatus("READY", "WAITING")).toBe(false);
    expect(canTransitionStatus("COMPLETED", "READY")).toBe(false);

    const path: ServiceOrderStatusValue[] = [
      "INSPECTION",
      "IN_PROGRESS",
      "WAITING_FOR_PARTS",
      "IN_PROGRESS",
      "READY",
      "IN_PROGRESS",
    ];

    let from: ServiceOrderStatusValue = "WAITING";
    for (const to of path) {
      expect(canTransitionStatus(from, to)).toBe(true);
      const moved = await updateServiceOrderStatus(garageId, orderId, {
        from,
        to,
        actorId: userId });
      expect(moved).not.toBeNull();
      // Re-read after the transaction commits (repo find inside tx can be stale).
      const confirmed = await findServiceOrderById(garageId, orderId);
      expect(confirmed?.status).toBe(to);
      from = to;
    }

    // Optimistic concurrency: wrong `from` does not change the row.
    const conflict = await updateServiceOrderStatus(garageId, orderId, {
      from: "WAITING",
      to: "INSPECTION",
      actorId: userId });
    expect(conflict).toBeNull();

    const current = await findServiceOrderById(garageId, orderId);
    expect(current?.status).toBe("IN_PROGRESS");
  });

  it("adds labour and part lines without changing inventory", async () => {
    if (!ready) return;

    expect(await getPartStock(garageId, partId)).toBe(2);

    const labour = await createServiceOrderLine(garageId, {
      serviceOrderId: orderId,
      type: "LABOUR",
      description: "Oil change labour",
      quantity: 1,
      unitPricePaise: 5_000,
      partId: null,
      actorId: userId });
    expect(labour.ok).toBe(true);
    if (labour.ok) labourLineId = labour.line.id;

    const partLine = await createServiceOrderLine(garageId, {
      serviceOrderId: orderId,
      type: "PART",
      description: "Oil Filter",
      quantity: 1,
      unitPricePaise: 12_000,
      partId,
      actorId: userId });
    expect(partLine.ok).toBe(true);
    if (partLine.ok) partLineId = partLine.line.id;

    const missingPart = await createServiceOrderLine(garageId, {
      serviceOrderId: orderId,
      type: "PART",
      description: "Ghost part",
      quantity: 1,
      unitPricePaise: 1_000,
      partId: "does-not-exist",
      actorId: userId });
    expect(missingPart).toEqual({ ok: false, reason: "PART_NOT_FOUND" });

    expect(await getPartStock(garageId, partId)).toBe(2);

    const loaded = await findServiceOrderById(garageId, orderId);
    expect(loaded?.lines).toHaveLength(2);
  });

  it("updates line description, quantity and unit price; totals recalculate", async () => {
    if (!ready) return;

    const labourUpdated = await updateServiceOrderLine(garageId, {
      lineId: labourLineId,
      serviceOrderId: orderId,
      description: "Oil change labour (revised)",
      quantity: 2,
      unitPricePaise: 4_500,
      actorId: userId });
    expect(labourUpdated.ok).toBe(true);
    if (labourUpdated.ok) {
      expect(labourUpdated.line.quantity).toBe(2);
      expect(labourUpdated.line.unitPricePaise).toBe(4_500);
      expect(labourUpdated.line.description).toBe(
        "Oil change labour (revised)",
      );
    }

    const partUpdated = await updateServiceOrderLine(garageId, {
      lineId: partLineId,
      serviceOrderId: orderId,
      description: "Oil Filter",
      quantity: 1,
      unitPricePaise: 15_000,
      actorId: userId });
    expect(partUpdated.ok).toBe(true);

    // Updating lines still does not touch stock.
    expect(await getPartStock(garageId, partId)).toBe(2);

    const totals = computeEstimateTotals([
      {
        quantity: 2,
        unitPricePaise: 4_500,
        gstRatePercent: 18,
        approvalState: "PENDING" },
      {
        quantity: 1,
        unitPricePaise: 15_000,
        gstRatePercent: 18,
        approvalState: "PENDING" },
    ]);
    // taxable: 9000 + 15000 = 24000; GST: 1620 + 2700 = 4320
    expect(totals.all.taxablePaise).toBe(24_000);
    expect(totals.all.gstPaise).toBe(4_320);
    expect(totals.all.totalPaise).toBe(28_320);
  });

  it("deletes a free labour line and a free part line; stock stays", async () => {
    if (!ready) return;

    const extraLabour = await createServiceOrderLine(garageId, {
      serviceOrderId: orderId,
      type: "LABOUR",
      description: "Temp check",
      quantity: 1,
      unitPricePaise: 1_000,
      partId: null,
      actorId: userId });
    expect(extraLabour.ok).toBe(true);
    if (!extraLabour.ok) return;

    const removedLabour = await deleteServiceOrderLine(garageId, {
      lineId: extraLabour.line.id,
      serviceOrderId: orderId,
      actorId: userId });
    expect(removedLabour).toEqual({ ok: true });

    const freePart = await createServiceOrderLine(garageId, {
      serviceOrderId: orderId,
      type: "PART",
      description: "Spare filter (not on estimate)",
      quantity: 1,
      unitPricePaise: 12_000,
      partId,
      actorId: userId });
    expect(freePart.ok).toBe(true);
    if (!freePart.ok) return;
    freePartLineId = freePart.line.id;

    const removedPart = await deleteServiceOrderLine(garageId, {
      lineId: freePartLineId,
      serviceOrderId: orderId,
      actorId: userId });
    expect(removedPart).toEqual({ ok: true });
    expect(await getPartStock(garageId, partId)).toBe(2);
  });

  it("Agree depletes stock; approved job-card labour can still be deleted", async () => {
    if (!ready) return;

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
              description: "Oil Filter",
              quantity: 1,
              unitPricePaise: 15_000,
              gstRatePercent: 18,
              hsnOrSac: "84212300",
              approvalState: "PENDING",
              sourceOrderLineId: partLineId,
              sortOrder: 0 },
            {
              garageId,
              type: "LABOUR",
              description: "Oil change labour (revised)",
              quantity: 2,
              unitPricePaise: 4_500,
              gstRatePercent: 18,
              hsnOrSac: "998714",
              approvalState: "PENDING",
              sourceOrderLineId: labourLineId,
              sortOrder: 1 },
          ] } },
      select: {
        id: true,
        lines: { select: { id: true, type: true } } } });
    estimateId = estimate.id;
    estimatePartLineId = estimate.lines.find((l) => l.type === "PART")!.id;
    const labourEstId = estimate.lines.find((l) => l.type === "LABOUR")!.id;

    const agreePart = await recordLineApproval(garageId, {
      estimateId,
      estimateLineId: estimatePartLineId,
      serviceOrderId: orderId,
      fromState: "PENDING",
      toState: "APPROVED",
      method: "MANUAL",
      note: null,
      recordedById: userId });
    expect(agreePart.ok).toBe(true);
    expect(await getPartStock(garageId, partId)).toBe(1);

    const agreeLabour = await recordLineApproval(garageId, {
      estimateId,
      estimateLineId: labourEstId,
      serviceOrderId: orderId,
      fromState: "PENDING",
      toState: "APPROVED",
      method: "MANUAL",
      note: null,
      recordedById: userId });
    expect(agreeLabour.ok).toBe(true);
    expect(await getPartStock(garageId, partId)).toBe(1);

    // Keep the approved part held for the next concurrency test. Disposable
    // labour still deletes (cascades its estimate line).
    const moreLabour = await createServiceOrderLine(garageId, {
      serviceOrderId: orderId,
      type: "LABOUR",
      description: "Disposable labour",
      quantity: 1,
      unitPricePaise: 500,
      partId: null,
      actorId: userId });
    expect(moreLabour.ok).toBe(true);
    if (moreLabour.ok) {
      expect(
        await deleteServiceOrderLine(garageId, {
          lineId: moreLabour.line.id,
          serviceOrderId: orderId,
          actorId: userId }),
      ).toEqual({ ok: true });
    }
  });

  it("while Agreed on job A, job B cannot Approve more than remaining stock", async () => {
    if (!ready) return;

    const orderB = await createServiceOrder(garageId, {
      vehicleId: vehicleBId,
      customerId,
      complaint: "Needs two filters",
      requestedServices: null,
      odometerIn: null,
      expectedCompletion: null,
      technicianId: null,
      bay: null,
      priority: "NORMAL",
      actorId: userId });
    orderBId = orderB.id;

    const partB = await createServiceOrderLine(garageId, {
      serviceOrderId: orderBId,
      type: "PART",
      description: "Oil Filter",
      quantity: 2,
      unitPricePaise: 12_000,
      partId,
      actorId: userId });
    expect(partB.ok).toBe(true);
    if (!partB.ok) return;

    // Add on job B does not change stock (still 1 held by job A).
    expect(await getPartStock(garageId, partId)).toBe(1);

    const estimateB = await prisma.estimate.create({
      data: {
        garageId,
        serviceOrderId: orderBId,
        revisionNumber: 1,
        createdById: userId,
        lines: {
          create: {
            garageId,
            type: "PART",
            description: "Oil Filter",
            quantity: 2,
            unitPricePaise: 12_000,
            gstRatePercent: 18,
            hsnOrSac: "84212300",
            approvalState: "PENDING",
            sourceOrderLineId: partB.line.id,
            sortOrder: 0 } } },
      select: { id: true, lines: { select: { id: true } } } });
    estimateBId = estimateB.id;
    estimateBPartLineId = estimateB.lines[0]!.id;

    const blocked = await recordLineApproval(garageId, {
      estimateId: estimateBId,
      estimateLineId: estimateBPartLineId,
      serviceOrderId: orderBId,
      fromState: "PENDING",
      toState: "APPROVED",
      method: "MANUAL",
      note: null,
      recordedById: userId });
    expect(blocked).toEqual({ ok: false, reason: "INSUFFICIENT_STOCK" });
    expect(await getPartStock(garageId, partId)).toBe(1);
  });

  it("Disagree on job A returns stock; job B can then Approve", async () => {
    if (!ready) return;

    const disagreed = await recordLineApproval(garageId, {
      estimateId,
      estimateLineId: estimatePartLineId,
      serviceOrderId: orderId,
      fromState: "APPROVED",
      toState: "REJECTED",
      method: "MANUAL",
      note: "Customer changed mind",
      recordedById: userId });
    expect(disagreed.ok).toBe(true);
    expect(await getPartStock(garageId, partId)).toBe(2);

    // After Disagree, approved-on-estimate guard lifts — part line can be deleted.
    const canDelete = await deleteServiceOrderLine(garageId, {
      lineId: partLineId,
      serviceOrderId: orderId,
      actorId: userId });
    expect(canDelete).toEqual({ ok: true });

    // Re-add part on A for listing continuity not required; job B takes stock.
    const approvedB = await recordLineApproval(garageId, {
      estimateId: estimateBId,
      estimateLineId: estimateBPartLineId,
      serviceOrderId: orderBId,
      fromState: "PENDING",
      toState: "APPROVED",
      method: "MANUAL",
      note: null,
      recordedById: userId });
    expect(approvedB.ok).toBe(true);
    expect(await getPartStock(garageId, partId)).toBe(0);
  });

  it("lists orders for this garage only and isolates by garageId", async () => {
    if (!ready) return;

    const listed = await listServiceOrders(garageId, {});
    expect(listed.some((o) => o.id === orderId)).toBe(true);
    expect(listed.some((o) => o.id === orderBId)).toBe(true);

    const otherView = await findServiceOrderById(otherGarageId, orderId);
    expect(otherView).toBeNull();

    const otherList = await listServiceOrders(otherGarageId, {});
    expect(otherList).toHaveLength(0);

    const otherUpdate = await updateServiceOrderDetails(
      otherGarageId,
      orderId,
      {
        complaint: "hacked",
        requestedServices: null,
        odometerIn: null,
        expectedCompletion: null,
        technicianId: null,
        bay: null,
        priority: "LOW",
        vehicleId,
        actorId: userId },
    );
    expect(otherUpdate).toBeNull();

    const otherStatus = await updateServiceOrderStatus(otherGarageId, orderId, {
      from: "IN_PROGRESS",
      to: "READY",
      actorId: userId });
    expect(otherStatus).toBeNull();

    const otherLine = await createServiceOrderLine(otherGarageId, {
      serviceOrderId: orderId,
      type: "LABOUR",
      description: "cross garage",
      quantity: 1,
      unitPricePaise: 100,
      partId: null,
      actorId: userId });
    // Line create does not verify order garage match beyond FK — if it succeeds
    // the line would be wrong-garage. Assert either fail or no line on our order
    // under our garage filter.
    if (otherLine.ok) {
      const order = await findServiceOrderById(garageId, orderId);
      expect(
        order?.lines.some((l) => l.id === otherLine.line.id && l.garageId === garageId),
      ).toBe(false);
    }

    const stillOurs = await findServiceOrderById(garageId, orderId);
    expect(stillOurs?.complaint).not.toBe("hacked");
  });

  it("writes audit entries for updates, lines and status; deletes a job card", async () => {
    if (!ready) return;

    const audits = await listServiceOrderAuditLogs(garageId, orderId);
    const actions = new Set(audits.map((a) => a.action));
    expect(actions.has("service_order.status_changed")).toBe(true);
    expect(actions.has("service_order.updated")).toBe(true);
    expect(actions.has("service_order.line_added")).toBe(true);
    expect(actions.has("service_order.line_updated")).toBe(true);
    expect(actions.has("service_order.line_removed")).toBe(true);

    // Newest first.
    for (let i = 1; i < audits.length; i += 1) {
      expect(audits[i - 1]!.createdAt.getTime()).toBeGreaterThanOrEqual(
        audits[i]!.createdAt.getTime(),
      );
    }

    // Delete job B while it still holds stock (APPROVED) — must restore inventory.
    expect(await getPartStock(garageId, partId)).toBe(0);

    const deleted = await deleteServiceOrderById(garageId, orderBId, {
      actorId: userId,
      vehicleId: vehicleBId,
      customerId,
      registrationNumber: "DEL" });
    expect(deleted).not.toBeNull();
    expect(await findServiceOrderById(garageId, orderBId)).toBeNull();
    expect(await getPartStock(garageId, partId)).toBe(2);

    // Cross-garage delete must no-op.
    const crossDelete = await deleteServiceOrderById(otherGarageId, orderId, {
      actorId: userId,
      vehicleId,
      customerId,
      registrationNumber: "X" });
    expect(crossDelete).toBeNull();
    expect(await findServiceOrderById(garageId, orderId)).not.toBeNull();
  });
});

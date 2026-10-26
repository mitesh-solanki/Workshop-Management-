/**
 * Live Postgres proofs for purchases: partial receipts, over-receive, concurrent
 * receipts, outstanding, garage isolation.
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

describe("purchases against Postgres", () => {
  let garageA = "";
  let garageB = "";
  let userA = "";
  let partA = "";
  let vendorA = "";
  let ready = false;

  beforeAll(async () => {
    ready = await dbReachable();
    if (!ready) return;

    const a = await prisma.garage.create({
      data: { name: `Purchases A ${suffix}`, allowNegativeStock: false },
      select: { id: true },
    });
    garageA = a.id;
    const b = await prisma.garage.create({
      data: { name: `Purchases B ${suffix}`, allowNegativeStock: false },
      select: { id: true },
    });
    garageB = b.id;

    const user = await prisma.user.create({
      data: {
        email: `purchases-a-${suffix}@example.com`,
        name: "Purchases Tester",
        role: "OWNER",
        garageId: garageA,
      },
      select: { id: true },
    });
    userA = user.id;

    const part = await prisma.part.create({
      data: {
        garageId: garageA,
        name: "Oil Filter",
        sku: `PO-${suffix}`.toUpperCase().slice(0, 64),
        unit: "pcs",
        purchasePricePaise: 200_00,
        sellingPricePaise: 350_00,
        gstRatePercent: 18,
        hsn: "84212300",
        lowStockLevel: 2,
      },
      select: { id: true },
    });
    partA = part.id;

    const vendor = await prisma.vendor.create({
      data: {
        garageId: garageA,
        name: `Vendor ${suffix}`,
        phone: "9999999999",
        gstin: "24AAAAA0000A1Z5",
      },
      select: { id: true },
    });
    vendorA = vendor.id;

    await prisma.vendor.create({
      data: {
        garageId: garageB,
        name: `Other garage vendor ${suffix}`,
      },
    });
  }, 30_000);

  afterAll(async () => {
    if (garageA) {
      await prisma.garage.delete({ where: { id: garageA } }).catch(() => undefined);
    }
    if (garageB) {
      await prisma.garage.delete({ where: { id: garageB } }).catch(() => undefined);
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

  it("isolates vendors by garageId", async () => {
    requireDb();
    const { searchVendors } = await import("@/modules/vendors/repo");
    const a = await searchVendors(garageA, undefined, 1, 50, "newest");
    const b = await searchVendors(garageB, undefined, 1, 50, "newest");
    expect(a.items.some((v) => v.id === vendorA)).toBe(true);
    expect(b.items.some((v) => v.id === vendorA)).toBe(false);
  });

  it("isolates purchase tables by garageId", async () => {
    requireDb();
    const {
      createPartsRequest,
      createPurchaseOrderFromRequests,
      receiveAgainstPurchaseOrder,
      createVendorBill,
      recordVendorBillPayment,
      createPurchaseReturn,
      findPartsRequestById,
      findPurchaseOrderById,
      findVendorBillById,
      findPurchaseReturnById,
      searchPartsRequests,
      searchPurchaseOrders,
      searchVendorBills,
      searchPurchaseReturns,
    } = await import("@/modules/purchases/repo");
    const { applyStockMovement } = await import("@/modules/inventory/repo");

    const request = await createPartsRequest(garageA, {
      partId: partA,
      quantity: 3,
      notes: null,
      serviceOrderId: null,
      serviceOrderLineId: null,
      actorId: userA,
    });
    const po = await createPurchaseOrderFromRequests(garageA, {
      vendorId: vendorA,
      notes: null,
      partsRequestIds: [request.id],
      actorId: userA,
    });
    const received = await receiveAgainstPurchaseOrder(garageA, {
      purchaseOrderId: po.id,
      notes: null,
      lines: [{ purchaseOrderLineId: po.lines[0]!.id, quantity: 1 }],
      actorId: userA,
    });
    await applyStockMovement(garageA, {
      partId: partA,
      type: "IN",
      quantity: 5,
      note: "seed isolation return",
      actorId: userA,
    });
    const bill = await createVendorBill(garageA, {
      vendorId: vendorA,
      purchaseOrderId: po.id,
      billNumber: `ISO-${suffix}`,
      billDate: new Date(),
      amountPaise: 500_00,
      notes: null,
      actorId: userA,
    });
    const payment = await recordVendorBillPayment(garageA, {
      vendorBillId: bill.id,
      amountPaise: 100_00,
      method: "CASH",
      notes: null,
      actorId: userA,
    });
    const purchaseReturn = await createPurchaseReturn(garageA, {
      vendorId: vendorA,
      vendorBillId: bill.id,
      partId: partA,
      quantity: 1,
      creditPaise: 50_00,
      notes: null,
      actorId: userA,
    });

    expect(await findPartsRequestById(garageB, request.id)).toBeNull();
    expect(await findPurchaseOrderById(garageB, po.id)).toBeNull();
    expect(await findVendorBillById(garageB, bill.id)).toBeNull();
    expect(await findPurchaseReturnById(garageB, purchaseReturn.id)).toBeNull();

    const bRequests = await searchPartsRequests(
      garageB,
      undefined,
      "ALL",
      "newest",
      1,
      50,
    );
    const bOrders = await searchPurchaseOrders(
      garageB,
      undefined,
      "ALL",
      "newest",
      1,
      50,
    );
    const bBills = await searchVendorBills(garageB, undefined, "newest", 1, 50);
    const bReturns = await searchPurchaseReturns(
      garageB,
      undefined,
      "newest",
      1,
      50,
    );
    expect(bRequests.items.some((r) => r.id === request.id)).toBe(false);
    expect(bOrders.items.some((o) => o.id === po.id)).toBe(false);
    expect(bBills.items.some((b) => b.id === bill.id)).toBe(false);
    expect(bReturns.items.some((r) => r.id === purchaseReturn.id)).toBe(false);

    const foreignLine = await prisma.purchaseOrderLine.findFirst({
      where: { id: po.lines[0]!.id, garageId: garageB },
    });
    const foreignReceipt = await prisma.goodsReceipt.findFirst({
      where: { id: received.receiptId, garageId: garageB },
    });
    const foreignReceiptLine = await prisma.goodsReceiptLine.findFirst({
      where: { goodsReceiptId: received.receiptId, garageId: garageB },
    });
    const foreignPayment = await prisma.vendorBillPayment.findFirst({
      where: { id: payment.id, garageId: garageB },
    });
    expect(foreignLine).toBeNull();
    expect(foreignReceipt).toBeNull();
    expect(foreignReceiptLine).toBeNull();
    expect(foreignPayment).toBeNull();
  });

  it("parts request becomes a purchase order; partial receipt raises stock once", async () => {
    requireDb();
    const {
      createPartsRequest,
      createPurchaseOrderFromRequests,
      receiveAgainstPurchaseOrder,
    } = await import("@/modules/purchases/repo");
    const { getPartStock } = await import("@/modules/inventory/repo");

    const before = await getPartStock(garageA, partA);

    const request = await createPartsRequest(garageA, {
      partId: partA,
      quantity: 10,
      notes: null,
      serviceOrderId: null,
      serviceOrderLineId: null,
      actorId: userA,
    });
    expect(request.status).toBe("OPEN");

    const po = await createPurchaseOrderFromRequests(garageA, {
      vendorId: vendorA,
      notes: null,
      partsRequestIds: [request.id],
      actorId: userA,
    });
    expect(po.status).toBe("PENDING");
    expect(po.lines).toHaveLength(1);
    expect(po.lines[0]?.quantityOrdered).toBe(10);

    const refreshed = await prisma.partsRequest.findUniqueOrThrow({
      where: { id: request.id },
    });
    expect(refreshed.status).toBe("ORDERED");
    expect(refreshed.purchaseOrderId).toBe(po.id);

    const lineId = po.lines[0]!.id;
    await receiveAgainstPurchaseOrder(garageA, {
      purchaseOrderId: po.id,
      notes: null,
      lines: [{ purchaseOrderLineId: lineId, quantity: 4 }],
      actorId: userA,
    });

    const afterPartial = await getPartStock(garageA, partA);
    expect(afterPartial).toBe(before + 4);

    const poAfter = await prisma.purchaseOrder.findUniqueOrThrow({
      where: { id: po.id },
      include: { lines: true },
    });
    expect(poAfter.status).toBe("PARTIALLY_RECEIVED");
    expect(poAfter.lines[0]?.quantityReceived).toBe(4);

    const movements = await prisma.stockMovement.count({
      where: {
        garageId: garageA,
        partId: partA,
        type: "IN",
        goodsReceiptLine: { purchaseOrderLineId: lineId },
      },
    });
    expect(movements).toBe(1);
  });

  it("cannot receive more than ordered", async () => {
    requireDb();
    const {
      createPartsRequest,
      createPurchaseOrderFromRequests,
      receiveAgainstPurchaseOrder,
    } = await import("@/modules/purchases/repo");

    const request = await createPartsRequest(garageA, {
      partId: partA,
      quantity: 3,
      notes: null,
      serviceOrderId: null,
      serviceOrderLineId: null,
      actorId: userA,
    });
    const po = await createPurchaseOrderFromRequests(garageA, {
      vendorId: vendorA,
      notes: null,
      partsRequestIds: [request.id],
      actorId: userA,
    });
    const lineId = po.lines[0]!.id;

    await expect(
      receiveAgainstPurchaseOrder(garageA, {
        purchaseOrderId: po.id,
        notes: null,
        lines: [{ purchaseOrderLineId: lineId, quantity: 5 }],
        actorId: userA,
      }),
    ).rejects.toMatchObject({
      code: "purchases.receive_exceeds_ordered",
    });
  });

  it("vendor outstanding equals bills minus payments minus returns", async () => {
    requireDb();
    const {
      createVendorBill,
      recordVendorBillPayment,
      createPurchaseReturn,
    } = await import("@/modules/purchases/repo");
    const { getVendorOutstandingPaise } = await import(
      "@/modules/vendors/repo"
    );
    const { applyStockMovement } = await import("@/modules/inventory/repo");

    await applyStockMovement(garageA, {
      partId: partA,
      type: "IN",
      quantity: 20,
      note: "seed for return",
      actorId: userA,
    });

    const bill = await createVendorBill(garageA, {
      vendorId: vendorA,
      purchaseOrderId: null,
      billNumber: `B-${suffix}`,
      billDate: new Date(),
      amountPaise: 10_000_00,
      notes: null,
      actorId: userA,
    });

    await recordVendorBillPayment(garageA, {
      vendorBillId: bill.id,
      amountPaise: 3_000_00,
      method: "CASH",
      notes: null,
      actorId: userA,
    });

    await createPurchaseReturn(garageA, {
      vendorId: vendorA,
      vendorBillId: bill.id,
      partId: partA,
      quantity: 1,
      creditPaise: 1_500_00,
      notes: null,
      actorId: userA,
    });

    const outstanding = await getVendorOutstandingPaise(garageA, vendorA);
    // May include other bills from earlier tests in same garage — compute from aggregates.
    const [bills, payments, returns] = await Promise.all([
      prisma.vendorBill.aggregate({
        where: { garageId: garageA, vendorId: vendorA },
        _sum: { amountPaise: true },
      }),
      prisma.vendorBillPayment.aggregate({
        where: { garageId: garageA, vendorBill: { vendorId: vendorA } },
        _sum: { amountPaise: true },
      }),
      prisma.purchaseReturn.aggregate({
        where: { garageId: garageA, vendorId: vendorA },
        _sum: { creditPaise: true },
      }),
    ]);
    expect(outstanding).toBe(
      (bills._sum.amountPaise ?? 0) -
        (payments._sum.amountPaise ?? 0) -
        (returns._sum.creditPaise ?? 0),
    );
  });

  it("serializes concurrent receipts so stock is not oversold past ordered", async () => {
    requireDb();
    const {
      createPartsRequest,
      createPurchaseOrderFromRequests,
      receiveAgainstPurchaseOrder,
    } = await import("@/modules/purchases/repo");
    const { getPartStock } = await import("@/modules/inventory/repo");

    const request = await createPartsRequest(garageA, {
      partId: partA,
      quantity: 6,
      notes: null,
      serviceOrderId: null,
      serviceOrderLineId: null,
      actorId: userA,
    });
    const po = await createPurchaseOrderFromRequests(garageA, {
      vendorId: vendorA,
      notes: null,
      partsRequestIds: [request.id],
      actorId: userA,
    });
    const lineId = po.lines[0]!.id;
    const before = await getPartStock(garageA, partA);

    const results = await Promise.allSettled([
      receiveAgainstPurchaseOrder(garageA, {
        purchaseOrderId: po.id,
        notes: null,
        lines: [{ purchaseOrderLineId: lineId, quantity: 4 }],
        actorId: userA,
      }),
      receiveAgainstPurchaseOrder(garageA, {
        purchaseOrderId: po.id,
        notes: null,
        lines: [{ purchaseOrderLineId: lineId, quantity: 4 }],
        actorId: userA,
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
    expect(fulfilled.length + rejected.length).toBe(2);

    const after = await getPartStock(garageA, partA);
    const line = await prisma.purchaseOrderLine.findUniqueOrThrow({
      where: { id: lineId },
    });
    expect(line.quantityReceived).toBeLessThanOrEqual(6);
    expect(after - before).toBe(line.quantityReceived);
  });
});

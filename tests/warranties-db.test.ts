/**
 * Postgres proofs for warranty cards + remake / draft-delete flows:
 * - upsert / clear photo on draft invoice lines
 * - battery finalize guard
 * - remake keeps warranties and picks up newly added job parts
 * - job-card delete cascades draft invoice lines
 * - garage isolation
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import type { RoleSession } from "@/lib/rbac";
import { AppError } from "@/lib/errors";
import {
  createInvoiceFromApprovedEstimate,
  remakeDraftInvoice,
} from "@/modules/billing/service";
import { recordLineApproval } from "@/modules/estimates/repo";
import {
  createServiceOrderLine,
  deleteServiceOrderLine,
} from "@/modules/service-orders/repo";
import {
  upsertInvoiceLineWarranty,
  listWarrantiesForInvoice,
  findWarrantyById,
} from "@/modules/warranties/repo";
import { assertBatteryWarrantiesCompleteForInvoice } from "@/modules/warranties/service";

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

describe("warranties + remake against Postgres", () => {
  let garageId = "";
  let otherGarageId = "";
  let userId = "";
  let customerId = "";
  let vehicleId = "";
  let padPartId = "";
  let batteryPartId = "";
  let orderId = "";
  let ready = false;

  beforeAll(async () => {
    ready = await dbReachable();
    if (!ready) return;

    const garage = await prisma.garage.create({
      data: {
        name: `Warr DB ${suffix}`,
        gstin: "24AABCU9603R1ZM",
        allowNegativeStock: false,
      },
      select: { id: true },
    });
    garageId = garage.id;

    const other = await prisma.garage.create({
      data: {
        name: `Warr other ${suffix}`,
        gstin: "27AABCU9603R1ZM",
        allowNegativeStock: false,
      },
      select: { id: true },
    });
    otherGarageId = other.id;

    const user = await prisma.user.create({
      data: {
        email: `warr-db-${suffix}@example.com`,
        name: "Warranty Tester",
        role: "OWNER",
        garageId,
      },
      select: { id: true },
    });
    userId = user.id;

    const customer = await prisma.customer.create({
      data: { garageId, name: "Warr Cust", phone: "9444444444" },
      select: { id: true },
    });
    customerId = customer.id;

    const vehicle = await prisma.vehicle.create({
      data: {
        garageId,
        customerId,
        registrationNumber: `GJ01W${suffix.slice(-4)}`.toUpperCase(),
        make: "Honda",
        model: "City",
        stateCode: "24",
      },
      select: { id: true },
    });
    vehicleId = vehicle.id;

    const pad = await prisma.part.create({
      data: {
        garageId,
        name: "Brake Pad",
        sku: `PAD-${suffix}`.toUpperCase().slice(0, 64),
        unit: "set",
        purchasePricePaise: 20_000,
        sellingPricePaise: 32_000,
        gstRatePercent: 18,
        hsn: "87083000",
        lowStockLevel: 0,
      },
      select: { id: true },
    });
    padPartId = pad.id;

    const battery = await prisma.part.create({
      data: {
        garageId,
        name: "battery",
        sku: `BAT-${suffix}`.toUpperCase().slice(0, 64),
        unit: "pc",
        purchasePricePaise: 30_000,
        sellingPricePaise: 45_000,
        gstRatePercent: 18,
        hsn: "85071000",
        lowStockLevel: 0,
      },
      select: { id: true },
    });
    batteryPartId = battery.id;

    await prisma.stockMovement.createMany({
      data: [
        {
          garageId,
          partId: padPartId,
          type: "IN",
          quantityChange: 20,
          note: "seed",
          createdById: userId,
        },
        {
          garageId,
          partId: batteryPartId,
          type: "IN",
          quantityChange: 10,
          note: "seed",
          createdById: userId,
        },
      ],
    });

    const order = await prisma.serviceOrder.create({
      data: {
        garageId,
        customerId,
        vehicleId,
        complaint: "Warranty remake flow",
        status: "IN_PROGRESS",
      },
      select: { id: true },
    });
    orderId = order.id;
  });

  afterAll(async () => {
    if (garageId) {
      await prisma.garage.deleteMany({
        where: { id: { in: [garageId, otherGarageId].filter(Boolean) } },
      });
    }
    await prisma.$disconnect();
  });

  function session(): RoleSession {
    return { userId, garageId, role: "OWNER" };
  }

  function warrantyKey(name: string) {
    return `garages/${garageId}/vehicles/${vehicleId}/warranty/${name}-${suffix}.jpg`;
  }

  it("upserts warranty, allows clearing photo, blocks finalize until battery complete", async () => {
    if (!ready) return;

    const padLine = await createServiceOrderLine(garageId, {
      serviceOrderId: orderId,
      type: "PART",
      description: "Brake Pad",
      quantity: 1,
      unitPricePaise: 32_000,
      partId: padPartId,
      actorId: userId,
    });
    expect(padLine.ok).toBe(true);
    if (!padLine.ok) return;

    const batteryLine = await createServiceOrderLine(garageId, {
      serviceOrderId: orderId,
      type: "PART",
      description: "battery",
      quantity: 1,
      unitPricePaise: 45_000,
      partId: batteryPartId,
      actorId: userId,
    });
    expect(batteryLine.ok).toBe(true);
    if (!batteryLine.ok) return;

    const estimate = await prisma.estimate.create({
      data: {
        garageId,
        serviceOrderId: orderId,
        revisionNumber: 1,
        askPermission: false,
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
              sourceOrderLineId: padLine.line.id,
              sortOrder: 0,
            },
            {
              garageId,
              type: "PART",
              description: "battery",
              quantity: 1,
              unitPricePaise: 45_000,
              gstRatePercent: 18,
              hsnOrSac: "85071000",
              approvalState: "PENDING",
              sourceOrderLineId: batteryLine.line.id,
              sortOrder: 1,
            },
          ],
        },
      },
      select: {
        id: true,
        lines: { select: { id: true, description: true } },
      },
    });

    for (const line of estimate.lines) {
      const agreed = await recordLineApproval(garageId, {
        estimateId: estimate.id,
        estimateLineId: line.id,
        serviceOrderId: orderId,
        fromState: "PENDING",
        toState: "APPROVED",
        method: "MANUAL",
        note: null,
        recordedById: userId,
      });
      expect(agreed.ok).toBe(true);
    }

    const draft = await createInvoiceFromApprovedEstimate(
      session(),
      orderId,
      { finalize: false },
    );
    expect(draft.status).toBe("DRAFT");
    expect(draft.lines.some((l) => l.description === "battery")).toBe(true);

    const batteryInvoiceLine = draft.lines.find(
      (l) => l.description === "battery",
    )!;
    const padInvoiceLine = draft.lines.find(
      (l) => l.description === "Brake Pad",
    )!;

    await expect(
      assertBatteryWarrantiesCompleteForInvoice(garageId, draft.id),
    ).rejects.toMatchObject({
      code: "warranties.battery_details_required",
    } satisfies Partial<AppError>);

    const created = await upsertInvoiceLineWarranty({
      garageId,
      vehicleId,
      customerId,
      partName: "battery",
      invoiceId: draft.id,
      invoiceLineId: batteryInvoiceLine.id,
      warrantyExpiresAt: new Date("2027-06-15T12:00:00.000Z"),
      storageKey: warrantyKey("battery"),
      contentType: "image/jpeg",
      byteSize: 2048,
      fileName: "battery-card.jpg",
      createdById: userId,
    });
    expect(created.storageKey).toContain("/warranty/");

    await assertBatteryWarrantiesCompleteForInvoice(garageId, draft.id);

    const cleared = await upsertInvoiceLineWarranty({
      garageId,
      vehicleId,
      customerId,
      partName: "battery",
      invoiceId: draft.id,
      invoiceLineId: batteryInvoiceLine.id,
      warrantyExpiresAt: new Date("2027-06-15T12:00:00.000Z"),
      storageKey: null,
      contentType: null,
      byteSize: null,
      fileName: null,
      createdById: userId,
    });
    expect(cleared.id).toBe(created.id);
    expect(cleared.storageKey).toBeNull();
    expect(cleared.warrantyExpiresAt).not.toBeNull();

    await expect(
      assertBatteryWarrantiesCompleteForInvoice(garageId, draft.id),
    ).rejects.toMatchObject({
      code: "warranties.battery_details_required",
    } satisfies Partial<AppError>);

    await upsertInvoiceLineWarranty({
      garageId,
      vehicleId,
      customerId,
      partName: "battery",
      invoiceId: draft.id,
      invoiceLineId: batteryInvoiceLine.id,
      warrantyExpiresAt: new Date("2027-06-15T12:00:00.000Z"),
      storageKey: warrantyKey("battery-restored"),
      contentType: "image/jpeg",
      byteSize: 3000,
      fileName: "battery-card.jpg",
      createdById: userId,
    });

    await upsertInvoiceLineWarranty({
      garageId,
      vehicleId,
      customerId,
      partName: "Brake Pad",
      invoiceId: draft.id,
      invoiceLineId: padInvoiceLine.id,
      warrantyExpiresAt: new Date("2026-10-21T12:00:00.000Z"),
      storageKey: warrantyKey("pad"),
      contentType: "image/jpeg",
      byteSize: 1500,
      fileName: "pad-card.jpg",
      createdById: userId,
    });

    const beforeRemake = await listWarrantiesForInvoice(garageId, draft.id);
    expect(beforeRemake).toHaveLength(2);

    const remade = await remakeDraftInvoice(session(), orderId, draft.id);
    expect(remade.id).not.toBe(draft.id);
    expect(remade.status).toBe("DRAFT");
    expect(remade.lines.map((l) => l.description).sort()).toEqual(
      ["Brake Pad", "battery"].sort(),
    );

    const afterRemake = await listWarrantiesForInvoice(garageId, remade.id);
    expect(afterRemake).toHaveLength(2);
    expect(
      afterRemake.every((doc) =>
        remade.lines.some((line) => line.id === doc.invoiceLineId),
      ),
    ).toBe(true);
    expect(
      afterRemake.find((d) => d.partName === "battery")?.storageKey,
    ).toContain("battery-restored");

    // Later-added job part should land on remake draft.
    const spare = await createServiceOrderLine(garageId, {
      serviceOrderId: orderId,
      type: "PART",
      description: "testing spare part addition",
      quantity: 1,
      unitPricePaise: 5_000,
      partId: padPartId,
      actorId: userId,
    });
    expect(spare.ok).toBe(true);
    if (!spare.ok) return;

    const remadeAgain = await remakeDraftInvoice(
      session(),
      orderId,
      remade.id,
    );
    expect(
      remadeAgain.lines.some(
        (l) => l.description === "testing spare part addition",
      ),
    ).toBe(true);
    expect(
      remadeAgain.lines.some((l) => l.description === "battery"),
    ).toBe(true);

    const kept = await listWarrantiesForInvoice(garageId, remadeAgain.id);
    expect(kept.some((d) => d.partName === "battery" && d.storageKey)).toBe(
      true,
    );
    expect(kept.some((d) => d.partName === "Brake Pad" && d.storageKey)).toBe(
      true,
    );

    // Draft delete of spare cascades estimate + draft invoice line.
    const spareInvoiceLine = remadeAgain.lines.find(
      (l) => l.description === "testing spare part addition",
    )!;
    expect(
      await deleteServiceOrderLine(garageId, {
        lineId: spare.line.id,
        serviceOrderId: orderId,
        actorId: userId,
      }),
    ).toEqual({ ok: true });

    const invoiceAfterDelete = await prisma.invoice.findFirst({
      where: { id: remadeAgain.id, garageId },
      select: {
        totalPaise: true,
        lines: { select: { id: true, description: true } },
      },
    });
    expect(
      invoiceAfterDelete?.lines.some((l) => l.id === spareInvoiceLine.id),
    ).toBe(false);
    expect(
      invoiceAfterDelete?.lines.some(
        (l) => l.description === "testing spare part addition",
      ),
    ).toBe(false);
    expect(invoiceAfterDelete?.totalPaise).toBeLessThan(remadeAgain.totalPaise);

    const cross = await findWarrantyById(otherGarageId, kept[0]!.id);
    expect(cross).toBeNull();
  });
});

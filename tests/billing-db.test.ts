/**
 * Live Postgres proofs for invoice number locking and credit notes.
 * Requires DATABASE_URL (defaults to local docker-compose on host port 5433).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  allocateInvoiceNumber,
  createAndFinalizeInvoice,
  createCreditNoteRow,
  createDraftInvoice,
  finalizeInvoiceInTransaction,
  recordPaymentRow,
  recordRefundRow,
} from "@/modules/billing/repo";
import {
  pendingBalancePaise,
  refundDuePaise,
} from "@/modules/billing/balance";

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

describe("billing against Postgres", () => {
  let garageId = "";
  let userId = "";
  let customerId = "";
  let vehicleId = "";
  let orderId = "";
  let estimateId = "";
  let estimateLineId = "";
  let ready = false;

  beforeAll(async () => {
    ready = await dbReachable();
    if (!ready) {
      return;
    }

    const garage = await prisma.garage.create({
      data: {
        name: `Billing test garage ${suffix}`,
        gstin: "24AABCU9603R1ZM",
        allowNegativeStock: false,
      },
      select: { id: true },
    });
    garageId = garage.id;

    const user = await prisma.user.create({
      data: {
        email: `billing-test-${suffix}@example.com`,
        name: "Billing Tester",
        role: "OWNER",
        garageId,
      },
      select: { id: true },
    });
    userId = user.id;

    const customer = await prisma.customer.create({
      data: {
        garageId,
        name: "Test Customer",
        phone: "9876543210",
      },
      select: { id: true },
    });
    customerId = customer.id;

    const vehicle = await prisma.vehicle.create({
      data: {
        garageId,
        customerId,
        registrationNumber: `GJ01T${suffix.slice(0, 4)}`.toUpperCase(),
        make: "Maruti",
        model: "Swift",
      },
      select: { id: true },
    });
    vehicleId = vehicle.id;

    const order = await prisma.serviceOrder.create({
      data: {
        garageId,
        customerId,
        vehicleId,
        complaint: "Billing test",
        status: "READY",
      },
      select: { id: true },
    });
    orderId = order.id;

    const estimate = await prisma.estimate.create({
      data: {
        garageId,
        serviceOrderId: orderId,
        revisionNumber: 1,
        createdById: userId,
        lines: {
          create: {
            garageId,
            type: "LABOUR",
            description: "Labour",
            quantity: 1,
            unitPricePaise: 100_000,
            gstRatePercent: 18,
            hsnOrSac: "998714",
            approvalState: "APPROVED",
            sortOrder: 0,
          },
        },
      },
      include: { lines: true },
    });
    estimateId = estimate.id;
    estimateLineId = estimate.lines[0]!.id;
  }, 30_000);

  afterAll(async () => {
    if (garageId) {
      await prisma.garage.delete({ where: { id: garageId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  it("serializes concurrent invoice number allocation without gaps or duplicates", async () => {
    if (!ready) {
      throw new Error(
        "Postgres not reachable — start docker compose and set DATABASE_URL",
      );
    }

    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        prisma.$transaction((tx) => allocateInvoiceNumber(tx, garageId)),
      ),
    );

    const sequences = results.map((r) => r.sequenceNumber).sort((a, b) => a - b);
    expect(sequences).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(new Set(results.map((r) => r.invoiceNumber)).size).toBe(8);
  });

  it("finalizes draft with a locked sequential number", async () => {
    if (!ready) {
      throw new Error("Postgres not reachable");
    }

    const draft = await createDraftInvoice(garageId, {
      serviceOrderId: orderId,
      estimateId,
      customerId,
      sellerStateCode: "24",
      placeOfSupplyStateCode: "24",
      gstSplit: "CGST_SGST",
      taxablePaise: 100_000,
      cgstPaise: 9_000,
      sgstPaise: 9_000,
      igstPaise: 0,
      totalPaise: 118_000,
      notes: null,
      createdById: userId,
      lines: [
        {
          estimateLineId,
          type: "LABOUR",
          description: "Labour",
          quantity: 1,
          unitPricePaise: 100_000,
          gstRatePercent: 18,
          hsnOrSac: "998714",
          taxablePaise: 100_000,
          cgstPaise: 9_000,
          sgstPaise: 9_000,
          igstPaise: 0,
          totalPaise: 118_000,
          sortOrder: 0,
        },
      ],
    });
    expect(draft?.status).toBe("DRAFT");
    expect(draft?.invoiceNumber).toBeNull();

    const finalized = await finalizeInvoiceInTransaction(
      garageId,
      draft!.id,
      userId,
    );
    expect(finalized && "invoice" in finalized && finalized.invoice?.status).toBe(
      "FINALIZED",
    );
    if (finalized && "allocated" in finalized && finalized.allocated) {
      expect(finalized.allocated.invoiceNumber).toMatch(
        /^INV-\d{4}-\d{2}-\d{4}$/,
      );
    }
  });

  it("creates a credit note against a finalized invoice and refuses over-credit", async () => {
    if (!ready) {
      throw new Error("Postgres not reachable");
    }

    const invoice = await createAndFinalizeInvoice(garageId, {
      serviceOrderId: orderId,
      estimateId,
      customerId,
      sellerStateCode: "24",
      placeOfSupplyStateCode: "27",
      gstSplit: "IGST",
      taxablePaise: 50_000,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: 9_000,
      totalPaise: 59_000,
      notes: null,
      createdById: userId,
      lines: [
        {
          estimateLineId: null,
          type: "PART",
          description: "Filter",
          quantity: 1,
          unitPricePaise: 50_000,
          gstRatePercent: 18,
          hsnOrSac: "87089900",
          taxablePaise: 50_000,
          cgstPaise: 0,
          sgstPaise: 0,
          igstPaise: 9_000,
          totalPaise: 59_000,
          sortOrder: 0,
        },
      ],
    });
    expect(invoice?.status).toBe("FINALIZED");

    const note = await createCreditNoteRow(garageId, {
      invoiceId: invoice!.id,
      reason: "CORRECTION",
      notes: "Price correction",
      actorId: userId,
      taxablePaise: 10_000,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: 1_800,
      totalPaise: 11_800,
      lines: [
        {
          description: "Filter credit",
          quantity: 1,
          unitPricePaise: 10_000,
          gstRatePercent: 18,
          hsnOrSac: "87089900",
          taxablePaise: 10_000,
          cgstPaise: 0,
          sgstPaise: 0,
          igstPaise: 1_800,
          totalPaise: 11_800,
          sortOrder: 0,
        },
      ],
    });
    expect(note && "creditNote" in note && note.creditNote?.creditNoteNumber).toMatch(
      /^CN-[A-Z0-9]{2,4}\/\d{4}-\d{2}\/\d{4}$/,
    );

    const over = await createCreditNoteRow(garageId, {
      invoiceId: invoice!.id,
      reason: "REFUND",
      notes: null,
      actorId: userId,
      taxablePaise: 50_000,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: 9_000,
      totalPaise: 59_000,
      lines: [
        {
          description: "Too much",
          quantity: 1,
          unitPricePaise: 50_000,
          gstRatePercent: 18,
          hsnOrSac: "87089900",
          taxablePaise: 50_000,
          cgstPaise: 0,
          sgstPaise: 0,
          igstPaise: 9_000,
          totalPaise: 59_000,
          sortOrder: 0,
        },
      ],
    });
    expect(over && "error" in over && over.error).toBe("exceeds_invoice");
  });

  it("records partial then mixed payments and refuses overpay", async () => {
    if (!ready) {
      throw new Error("Postgres not reachable");
    }

    const invoice = await createAndFinalizeInvoice(garageId, {
      serviceOrderId: orderId,
      estimateId,
      customerId,
      sellerStateCode: "24",
      placeOfSupplyStateCode: "24",
      gstSplit: "CGST_SGST",
      taxablePaise: 100_000,
      cgstPaise: 9_000,
      sgstPaise: 9_000,
      igstPaise: 0,
      totalPaise: 118_000,
      notes: null,
      createdById: userId,
      lines: [
        {
          estimateLineId: null,
          type: "LABOUR",
          description: "Labour pay test",
          quantity: 1,
          unitPricePaise: 100_000,
          gstRatePercent: 18,
          hsnOrSac: "998714",
          taxablePaise: 100_000,
          cgstPaise: 9_000,
          sgstPaise: 9_000,
          igstPaise: 0,
          totalPaise: 118_000,
          sortOrder: 0,
        },
      ],
    });
    expect(invoice?.status).toBe("FINALIZED");
    expect(invoice?.amountPaidPaise).toBe(0);

    const partial = await recordPaymentRow(garageId, {
      invoiceId: invoice!.id,
      method: "UPI",
      amountPaise: 40_000,
      cashPaise: 0,
      upiPaise: 40_000,
      cardPaise: 0,
      note: "partial upi",
      actorId: userId,
    });
    expect(partial && "payment" in partial && partial.payment?.amountPaise).toBe(
      40_000,
    );
    expect(partial && "invoice" in partial && partial.invoice?.amountPaidPaise).toBe(
      40_000,
    );
    expect(
      pendingBalancePaise({
        totalPaise: 118_000,
        amountPaidPaise: 40_000,
        creditNotesTotalPaise: 0,
      }),
    ).toBe(78_000);

    const mixed = await recordPaymentRow(garageId, {
      invoiceId: invoice!.id,
      method: "MIXED",
      amountPaise: 50_000,
      cashPaise: 20_000,
      upiPaise: 15_000,
      cardPaise: 15_000,
      note: "mixed remainder chunk",
      actorId: userId,
    });
    expect(mixed && "payment" in mixed && mixed.payment?.method).toBe("MIXED");
    expect(mixed && "payment" in mixed && mixed.payment?.cashPaise).toBe(20_000);
    expect(mixed && "payment" in mixed && mixed.payment?.upiPaise).toBe(15_000);
    expect(mixed && "payment" in mixed && mixed.payment?.cardPaise).toBe(15_000);
    expect(mixed && "invoice" in mixed && mixed.invoice?.amountPaidPaise).toBe(
      90_000,
    );

    const over = await recordPaymentRow(garageId, {
      invoiceId: invoice!.id,
      method: "CASH",
      amountPaise: 30_000,
      cashPaise: 30_000,
      upiPaise: 0,
      cardPaise: 0,
      note: null,
      actorId: userId,
    });
    expect(over && "error" in over && over.error).toBe("overpay");
    expect(over && "error" in over && over.pending).toBe(28_000);

    const foreign = await recordPaymentRow(`not-${garageId}`, {
      invoiceId: invoice!.id,
      method: "CASH",
      amountPaise: 1_000,
      cashPaise: 1_000,
      upiPaise: 0,
      cardPaise: 0,
      note: null,
      actorId: userId,
    });
    expect(foreign).toBeNull();

    const still = await prisma.invoice.findFirst({
      where: { id: invoice!.id, garageId },
      select: { amountPaidPaise: true },
    });
    expect(still?.amountPaidPaise).toBe(90_000);
  });

  it("shows refund due after credit note on a fully paid invoice and records cash returned", async () => {
    if (!ready) {
      throw new Error("Postgres not reachable");
    }

    const invoice = await createAndFinalizeInvoice(garageId, {
      serviceOrderId: orderId,
      estimateId,
      customerId,
      sellerStateCode: "24",
      placeOfSupplyStateCode: "24",
      gstSplit: "CGST_SGST",
      taxablePaise: 100_000,
      cgstPaise: 9_000,
      sgstPaise: 9_000,
      igstPaise: 0,
      totalPaise: 118_000,
      notes: null,
      createdById: userId,
      lines: [
        {
          estimateLineId: null,
          type: "LABOUR",
          description: "Refund labour",
          quantity: 1,
          unitPricePaise: 100_000,
          gstRatePercent: 18,
          hsnOrSac: "998714",
          taxablePaise: 100_000,
          cgstPaise: 9_000,
          sgstPaise: 9_000,
          igstPaise: 0,
          totalPaise: 118_000,
          sortOrder: 0,
        },
      ],
    });

    const paid = await recordPaymentRow(garageId, {
      invoiceId: invoice!.id,
      method: "UPI",
      amountPaise: 118_000,
      cashPaise: 0,
      upiPaise: 118_000,
      cardPaise: 0,
      note: null,
      actorId: userId,
    });
    expect(paid && "invoice" in paid && paid.invoice?.amountPaidPaise).toBe(
      118_000,
    );

    const note = await createCreditNoteRow(garageId, {
      invoiceId: invoice!.id,
      reason: "REFUND",
      notes: "Part returned",
      actorId: userId,
      taxablePaise: 10_000,
      cgstPaise: 900,
      sgstPaise: 900,
      igstPaise: 0,
      totalPaise: 11_800,
      lines: [
        {
          description: "Part return",
          quantity: 1,
          unitPricePaise: 10_000,
          gstRatePercent: 18,
          hsnOrSac: "87089900",
          taxablePaise: 10_000,
          cgstPaise: 900,
          sgstPaise: 900,
          igstPaise: 0,
          totalPaise: 11_800,
          sortOrder: 0,
        },
      ],
    });
    expect(note && "creditNote" in note).toBe(true);

    const due = refundDuePaise({
      totalPaise: 118_000,
      amountPaidPaise: 118_000,
      creditNotesTotalPaise: 11_800,
    });
    expect(due).toBe(11_800);

    const refund = await recordRefundRow(garageId, {
      invoiceId: invoice!.id,
      method: "CASH",
      amountPaise: 11_800,
      cashPaise: 11_800,
      upiPaise: 0,
      cardPaise: 0,
      note: "Cash returned",
      actorId: userId,
    });
    expect(refund && "payment" in refund && refund.payment?.isRefund).toBe(true);
    expect(refund && "invoice" in refund && refund.invoice?.amountPaidPaise).toBe(
      106_200,
    );
    expect(
      refundDuePaise({
        totalPaise: 118_000,
        amountPaidPaise: 106_200,
        creditNotesTotalPaise: 11_800,
      }),
    ).toBe(0);
    expect(
      pendingBalancePaise({
        totalPaise: 118_000,
        amountPaidPaise: 106_200,
        creditNotesTotalPaise: 11_800,
      }),
    ).toBe(0);
  });

  it("refuses a second finalize on the same draft (double-finalize race)", async () => {
    if (!ready) {
      throw new Error("Postgres not reachable");
    }

    const draft = await createDraftInvoice(garageId, {
      serviceOrderId: orderId,
      estimateId,
      customerId,
      sellerStateCode: "24",
      placeOfSupplyStateCode: "24",
      gstSplit: "CGST_SGST",
      taxablePaise: 10_000,
      cgstPaise: 900,
      sgstPaise: 900,
      igstPaise: 0,
      totalPaise: 11_800,
      notes: null,
      createdById: userId,
      lines: [
        {
          estimateLineId: null,
          type: "LABOUR",
          description: "Race labour",
          quantity: 1,
          unitPricePaise: 10_000,
          gstRatePercent: 18,
          hsnOrSac: "998714",
          taxablePaise: 10_000,
          cgstPaise: 900,
          sgstPaise: 900,
          igstPaise: 0,
          totalPaise: 11_800,
          sortOrder: 0,
        },
      ],
    });
    expect(draft?.status).toBe("DRAFT");

    const [first, second] = await Promise.all([
      finalizeInvoiceInTransaction(garageId, draft!.id, userId),
      finalizeInvoiceInTransaction(garageId, draft!.id, userId),
    ]);

    const outcomes = [first, second];
    const winners = outcomes.filter((r) => r && "invoice" in r && r.invoice);
    const conflicts = outcomes.filter((r) => r && "conflict" in r);
    expect(winners).toHaveLength(1);
    expect(conflicts).toHaveLength(1);
    expect(winners[0] && "invoice" in winners[0] && winners[0].invoice?.status).toBe(
      "FINALIZED",
    );
  });
});

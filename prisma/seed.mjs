/**
 * Demo seed for local content review across implemented modules.
 *
 * Targets your real garage by default (name "prime", or SEED_GARAGE_ID).
 * Core demo (customers / job cards): wipe seed_* then recreate.
 * Newer modules: seed once when empty for that garage (see MODULE_SEEDS).
 *
 * Usage: npm run db:seed
 *
 * Not seeded yet: reminders, appointments, AMC. Billing/payments when added.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CHECKLIST = [
  { key: "brakes", label: "Brakes" },
  { key: "tyres", label: "Tyres" },
  { key: "battery", label: "Battery" },
  { key: "lights", label: "Lights" },
  { key: "fluids", label: "Fluids" },
  { key: "suspension", label: "Suspension" },
  { key: "ac", label: "AC" },
];

const LABOUR_SAC = "998714";
const PART_HSN = "87089900";

function daysFromNow(days) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

function hoursFromNow(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

async function resolveGarage() {
  if (process.env.SEED_GARAGE_ID) {
    const byId = await prisma.garage.findUnique({
      where: { id: process.env.SEED_GARAGE_ID },
    });
    if (!byId) {
      throw new Error(`SEED_GARAGE_ID not found: ${process.env.SEED_GARAGE_ID}`);
    }
    return byId;
  }

  const prime = await prisma.garage.findFirst({
    where: { name: { equals: "prime", mode: "insensitive" } },
  });
  if (prime) return prime;

  const withOwner = await prisma.user.findFirst({
    where: {
      role: "OWNER",
      NOT: { email: { contains: "example.com" } },
    },
    include: { garage: true },
    orderBy: { createdAt: "asc" },
  });
  if (withOwner) return withOwner.garage;

  return prisma.garage.create({
    data: {
      id: "seed_garage",
      name: "Prime Motors",
      address: "12 Ring Road, Surat, Gujarat 395007",
      gstin: "24ABCDE1234F1Z5",
    },
  });
}

async function clearDirectSalesSeed(garageId) {
  const seedId = { garageId, id: { startsWith: "seed_" } };

  await prisma.stockMovement.deleteMany({
    where: {
      garageId,
      OR: [
        { id: { startsWith: "seed_sm_sale_" } },
        { directSaleId: { startsWith: "seed_" } },
        { directSaleLineId: { startsWith: "seed_" } },
      ],
    },
  });
  await prisma.directSaleLine.deleteMany({ where: seedId });
  await prisma.directSale.deleteMany({ where: seedId });
}

async function clearVendorsPurchasesSeed(garageId) {
  const seedId = { garageId, id: { startsWith: "seed_" } };

  await prisma.stockMovement.deleteMany({
    where: {
      garageId,
      OR: [
        { id: { startsWith: "seed_" } },
        { purchaseReturnId: { startsWith: "seed_" } },
        { goodsReceiptLineId: { startsWith: "seed_" } },
        { directSaleId: { startsWith: "seed_" } },
        { directSaleLineId: { startsWith: "seed_" } },
      ],
    },
  });
  await prisma.directSaleLine.deleteMany({ where: seedId });
  await prisma.directSale.deleteMany({ where: seedId });
  await prisma.purchaseReturn.deleteMany({ where: seedId });
  await prisma.vendorBillPayment.deleteMany({ where: seedId });
  await prisma.vendorBill.deleteMany({ where: seedId });
  await prisma.goodsReceiptLine.deleteMany({ where: seedId });
  await prisma.goodsReceipt.deleteMany({ where: seedId });
  await prisma.purchaseOrderLine.deleteMany({ where: seedId });
  await prisma.partsRequest.deleteMany({ where: seedId });
  await prisma.purchaseOrder.deleteMany({ where: seedId });
  await prisma.vendor.deleteMany({ where: seedId });
  await prisma.part.deleteMany({ where: seedId });
}

async function clearPreviousSeed(garageId) {
  await clearDirectSalesSeed(garageId);
  await clearVendorsPurchasesSeed(garageId);

  const seedLinkedInvoice = {
    OR: [
      { id: { startsWith: "seed_" } },
      { estimateId: { startsWith: "seed_" } },
      { serviceOrderId: { startsWith: "seed_" } },
      { customerId: { startsWith: "seed_" } },
      { serviceOrder: { is: { vehicleId: { startsWith: "seed_" } } } },
      { serviceOrder: { is: { customerId: { startsWith: "seed_" } } } },
    ],
  };

  // Billing blocks estimate/order deletes (Restrict FKs).
  await prisma.payment.deleteMany({
    where: { garageId, OR: [{ id: { startsWith: "seed_" } }, { invoice: { is: seedLinkedInvoice } }] },
  });
  await prisma.creditNoteLine.deleteMany({
    where: {
      garageId,
      creditNote: { is: { OR: [{ id: { startsWith: "seed_" } }, { invoice: { is: seedLinkedInvoice } }] } },
    },
  });
  await prisma.creditNote.deleteMany({
    where: {
      garageId,
      OR: [{ id: { startsWith: "seed_" } }, { invoice: { is: seedLinkedInvoice } }],
    },
  });
  await prisma.invoiceLine.deleteMany({
    where: { garageId, invoice: { is: seedLinkedInvoice } },
  });
  await prisma.invoice.deleteMany({
    where: { garageId, ...seedLinkedInvoice },
  });

  // Children first — estimates / inspections cascade from orders, but fixed ids need order.
  await prisma.estimateApproval.deleteMany({
    where: { garageId, id: { startsWith: "seed_" } },
  });
  await prisma.estimateLine.deleteMany({
    where: { garageId, id: { startsWith: "seed_" } },
  });
  await prisma.estimate.deleteMany({
    where: { garageId, id: { startsWith: "seed_" } },
  });
  await prisma.suggestedRepair.deleteMany({
    where: { garageId, id: { startsWith: "seed_" } },
  });
  await prisma.media.deleteMany({
    where: { garageId, id: { startsWith: "seed_" } },
  });
  await prisma.inspectionItem.deleteMany({
    where: { garageId, id: { startsWith: "seed_" } },
  });
  await prisma.inspection.deleteMany({
    where: { garageId, id: { startsWith: "seed_" } },
  });
  await prisma.serviceOrderLine.deleteMany({
    where: {
      garageId,
      OR: [
        { id: { startsWith: "seed_" } },
        { serviceOrderId: { startsWith: "seed_" } },
        { serviceOrder: { is: { vehicleId: { startsWith: "seed_" } } } },
        { serviceOrder: { is: { customerId: { startsWith: "seed_" } } } },
      ],
    },
  });
  // Include non-seed orders that still point at seed customers/vehicles.
  await prisma.serviceOrder.deleteMany({
    where: {
      garageId,
      OR: [
        { id: { startsWith: "seed_" } },
        { vehicleId: { startsWith: "seed_" } },
        { customerId: { startsWith: "seed_" } },
      ],
    },
  });
  await prisma.vehicle.deleteMany({
    where: { garageId, id: { startsWith: "seed_" } },
  });
  await prisma.customer.deleteMany({
    where: { garageId, id: { startsWith: "seed_" } },
  });
  await prisma.auditLog.deleteMany({
    where: { garageId, id: { startsWith: "seed_" } },
  });
  await prisma.invite.deleteMany({
    where: { garageId, id: { startsWith: "seed_" } },
  });
  // Seed team users (email unique globally) — keep OWNER if it is seed_user_owner.
  await prisma.user.deleteMany({
    where: {
      garageId,
      id: { startsWith: "seed_" },
      NOT: { role: "OWNER" },
    },
  });
}

function forcedModules() {
  const raw = process.env.SEED_FORCE_MODULES?.trim();
  if (!raw) return new Set();
  if (raw === "1" || raw.toLowerCase() === "all") return null; // null = force all
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

/**
 * Run a module seed only when that garage has no real data for it yet.
 * Force with SEED_FORCE_MODULES=1 or SEED_FORCE_MODULES=vendors-and-purchases
 * (only refreshes seed_* rows for that module — never deletes staff-created rows).
 * Add new modules to MODULE_SEEDS — same pattern tomorrow.
 */
async function seedModuleOnce(garageId, ownerId, module) {
  const forced = forcedModules();
  const force =
    forced === null || (forced instanceof Set && forced.has(module.key));
  const empty = await module.isEmpty(garageId);
  if (!empty && !force) {
    console.log(`Skip ${module.key}: already has data for this garage`);
    return false;
  }
  if (module.clear) {
    await module.clear(garageId);
  }
  await module.seed({ garageId, ownerId });
  console.log(`Seeded ${module.key}${force && !empty ? " (forced)" : ""}`);
  return true;
}

async function seedVendorsAndPurchases({ garageId, ownerId }) {
  const partSpecs = [
    {
      id: "seed_part_oil",
      name: "Engine oil 5W-30",
      sku: "SEED-OIL-5W30",
      unit: "L",
      purchasePricePaise: 45000,
      sellingPricePaise: 65000,
      lowStockLevel: 4,
      opening: 3,
    },
    {
      id: "seed_part_pads",
      name: "Brake pad set (front)",
      sku: "SEED-BRK-PAD-F",
      unit: "set",
      purchasePricePaise: 120000,
      sellingPricePaise: 180000,
      lowStockLevel: 2,
      opening: 2,
    },
    {
      id: "seed_part_filter",
      name: "Air filter",
      sku: "SEED-AIR-FLT",
      unit: "pcs",
      purchasePricePaise: 25000,
      sellingPricePaise: 40000,
      lowStockLevel: 3,
      opening: 1,
    },
    {
      id: "seed_part_plugs",
      name: "Spark plug IRIDIUM",
      sku: "SEED-SPK-IRD",
      unit: "pcs",
      purchasePricePaise: 35000,
      sellingPricePaise: 55000,
      lowStockLevel: 4,
      opening: 4,
    },
    {
      id: "seed_part_wiper",
      name: "Wiper blade 24in",
      sku: "SEED-WIP-24",
      unit: "pcs",
      purchasePricePaise: 18000,
      sellingPricePaise: 32000,
      lowStockLevel: 5,
      opening: 6,
    },
    {
      id: "seed_part_coolant",
      name: "Coolant concentrate 1L",
      sku: "SEED-COOL-1L",
      unit: "L",
      purchasePricePaise: 22000,
      sellingPricePaise: 38000,
      lowStockLevel: 4,
      opening: 2,
    },
    {
      id: "seed_part_battery",
      name: "Battery 35Ah",
      sku: "SEED-BAT-35",
      unit: "pcs",
      purchasePricePaise: 320000,
      sellingPricePaise: 450000,
      lowStockLevel: 1,
      opening: 1,
    },
    {
      id: "seed_part_belt",
      name: "Drive belt",
      sku: "SEED-BELT-01",
      unit: "pcs",
      purchasePricePaise: 55000,
      sellingPricePaise: 85000,
      lowStockLevel: 2,
      opening: 0,
    },
  ];

  const parts = {};
  for (const spec of partSpecs) {
    parts[spec.id] = await prisma.part.create({
      data: {
        id: spec.id,
        garageId,
        name: spec.name,
        sku: spec.sku,
        unit: spec.unit,
        purchasePricePaise: spec.purchasePricePaise,
        sellingPricePaise: spec.sellingPricePaise,
        gstRatePercent: 18,
        hsn: PART_HSN,
        lowStockLevel: spec.lowStockLevel,
      },
    });
  }

  await prisma.stockMovement.createMany({
    data: partSpecs
      .filter((spec) => spec.opening > 0)
      .map((spec) => ({
        id: `seed_sm_open_${spec.id.replace("seed_part_", "")}`,
        garageId,
        partId: spec.id,
        type: "IN",
        quantityChange: spec.opening,
        note: "Seed opening stock",
        createdById: ownerId,
      })),
  });

  const vendors = [
    {
      id: "seed_vendor_01",
      name: "Auto Parts Hub",
      phone: "9876500101",
      email: "sales@autopartshub.example",
      address: "12 Industrial Estate, Surat",
      gstin: "24AAAPA1234A1Z5",
      notes: "Primary spare parts — brake, filters, belts",
    },
    {
      id: "seed_vendor_02",
      name: "Lubricants Plus",
      phone: "9876500202",
      email: "orders@lubeplus.example",
      address: "45 Ring Road, Surat",
      gstin: "24AAAPL5678B1Z2",
      notes: "Oils, coolants and fluids",
    },
    {
      id: "seed_vendor_03",
      name: "Battery World",
      phone: "9876500303",
      email: "desk@batteryworld.example",
      address: "88 Udhna Magdalla Road, Surat",
      gstin: "24AAABW9012C1Z8",
      notes: "Batteries and electrical",
    },
    {
      id: "seed_vendor_04",
      name: "City Tyres & More",
      phone: "9876500404",
      email: null,
      address: "Near Katargam Fire Station, Surat",
      gstin: null,
      notes: "Walk-in vendor — wipers and small parts",
    },
  ];

  for (const vendor of vendors) {
    await prisma.vendor.create({
      data: { ...vendor, garageId },
    });
  }

  // —— Parts requests (open / ordered / cancelled) ——
  await prisma.partsRequest.createMany({
    data: [
      {
        id: "seed_pr_open_01",
        garageId,
        partId: parts.seed_part_filter.id,
        quantity: 8,
        status: "OPEN",
        notes: "Low stock — air filters for service bay",
        createdById: ownerId,
      },
      {
        id: "seed_pr_open_02",
        garageId,
        partId: parts.seed_part_belt.id,
        quantity: 3,
        status: "OPEN",
        notes: "Drive belts for Swift jobs this week",
        createdById: ownerId,
      },
      {
        id: "seed_pr_open_03",
        garageId,
        partId: parts.seed_part_wiper.id,
        quantity: 10,
        status: "OPEN",
        notes: "Monsoon stock-up",
        createdById: ownerId,
      },
      {
        id: "seed_pr_cancelled",
        garageId,
        partId: parts.seed_part_plugs.id,
        quantity: 4,
        status: "CANCELLED",
        notes: "Customer brought own plugs",
        createdById: ownerId,
      },
    ],
  });

  // —— PO 1: Auto Parts Hub — 3 lines, 2 items partly/fully received ——
  const po1 = await prisma.purchaseOrder.create({
    data: {
      id: "seed_po_01",
      garageId,
      vendorId: "seed_vendor_01",
      number: "PO-SEED-0001",
      status: "PARTIALLY_RECEIVED",
      notes: "Mixed restock — oil still pending on line 3",
      createdById: ownerId,
      lines: {
        create: [
          {
            id: "seed_pol_01a",
            garageId,
            partId: parts.seed_part_pads.id,
            quantityOrdered: 6,
            quantityReceived: 6,
            unitCostPaise: parts.seed_part_pads.purchasePricePaise,
            sortOrder: 0,
          },
          {
            id: "seed_pol_01b",
            garageId,
            partId: parts.seed_part_filter.id,
            quantityOrdered: 12,
            quantityReceived: 12,
            unitCostPaise: parts.seed_part_filter.purchasePricePaise,
            sortOrder: 1,
          },
          {
            id: "seed_pol_01c",
            garageId,
            partId: parts.seed_part_plugs.id,
            quantityOrdered: 16,
            quantityReceived: 8,
            unitCostPaise: parts.seed_part_plugs.purchasePricePaise,
            sortOrder: 2,
          },
        ],
      },
    },
  });

  await prisma.partsRequest.createMany({
    data: [
      {
        id: "seed_pr_ord_01",
        garageId,
        partId: parts.seed_part_pads.id,
        quantity: 6,
        status: "ORDERED",
        notes: "Front pads for City ZX",
        purchaseOrderId: po1.id,
        createdById: ownerId,
      },
      {
        id: "seed_pr_ord_02",
        garageId,
        partId: parts.seed_part_filter.id,
        quantity: 12,
        status: "ORDERED",
        notes: "Bulk air filters",
        purchaseOrderId: po1.id,
        createdById: ownerId,
      },
      {
        id: "seed_pr_ord_03",
        garageId,
        partId: parts.seed_part_plugs.id,
        quantity: 16,
        status: "ORDERED",
        notes: "Iridium plugs — half received",
        purchaseOrderId: po1.id,
        createdById: ownerId,
      },
    ],
  });

  await prisma.goodsReceipt.create({
    data: {
      id: "seed_gr_01",
      garageId,
      purchaseOrderId: po1.id,
      notes: "First truck — pads + filters + half plugs",
      createdById: ownerId,
      lines: {
        create: [
          {
            id: "seed_grl_01a",
            garageId,
            purchaseOrderLineId: "seed_pol_01a",
            partId: parts.seed_part_pads.id,
            quantity: 6,
          },
          {
            id: "seed_grl_01b",
            garageId,
            purchaseOrderLineId: "seed_pol_01b",
            partId: parts.seed_part_filter.id,
            quantity: 12,
          },
          {
            id: "seed_grl_01c",
            garageId,
            purchaseOrderLineId: "seed_pol_01c",
            partId: parts.seed_part_plugs.id,
            quantity: 8,
          },
        ],
      },
    },
  });

  await prisma.stockMovement.createMany({
    data: [
      {
        id: "seed_sm_recv_01a",
        garageId,
        partId: parts.seed_part_pads.id,
        type: "IN",
        quantityChange: 6,
        note: "Seed PO-SEED-0001 receipt",
        goodsReceiptLineId: "seed_grl_01a",
        createdById: ownerId,
      },
      {
        id: "seed_sm_recv_01b",
        garageId,
        partId: parts.seed_part_filter.id,
        type: "IN",
        quantityChange: 12,
        note: "Seed PO-SEED-0001 receipt",
        goodsReceiptLineId: "seed_grl_01b",
        createdById: ownerId,
      },
      {
        id: "seed_sm_recv_01c",
        garageId,
        partId: parts.seed_part_plugs.id,
        type: "IN",
        quantityChange: 8,
        note: "Seed PO-SEED-0001 receipt",
        goodsReceiptLineId: "seed_grl_01c",
        createdById: ownerId,
      },
    ],
  });

  const bill1Amount =
    6 * parts.seed_part_pads.purchasePricePaise +
    12 * parts.seed_part_filter.purchasePricePaise +
    8 * parts.seed_part_plugs.purchasePricePaise;

  const bill1 = await prisma.vendorBill.create({
    data: {
      id: "seed_vb_01",
      garageId,
      vendorId: "seed_vendor_01",
      purchaseOrderId: po1.id,
      billNumber: "APH-INV-2401",
      billDate: daysFromNow(-5),
      amountPaise: bill1Amount,
      notes: "Bill for PO-SEED-0001 received lines (no attachment)",
      createdById: ownerId,
    },
  });

  await prisma.vendorBillPayment.createMany({
    data: [
      {
        id: "seed_vbp_01a",
        garageId,
        vendorBillId: bill1.id,
        amountPaise: 500000,
        method: "UPI",
        paidAt: daysFromNow(-3),
        notes: "Partial UPI",
        createdById: ownerId,
      },
      {
        id: "seed_vbp_01b",
        garageId,
        vendorBillId: bill1.id,
        amountPaise: 300000,
        method: "BANK",
        paidAt: daysFromNow(-1),
        notes: "NEFT part payment",
        createdById: ownerId,
      },
    ],
  });

  await prisma.purchaseReturn.create({
    data: {
      id: "seed_ret_01",
      garageId,
      vendorId: "seed_vendor_01",
      vendorBillId: bill1.id,
      partId: parts.seed_part_filter.id,
      quantity: 2,
      creditPaise: 2 * parts.seed_part_filter.purchasePricePaise,
      notes: "Two filters crushed in transit",
      createdById: ownerId,
    },
  });
  await prisma.stockMovement.create({
    data: {
      id: "seed_sm_ret_01",
      garageId,
      partId: parts.seed_part_filter.id,
      type: "OUT",
      quantityChange: -2,
      note: "Seed purchase return",
      purchaseReturnId: "seed_ret_01",
      createdById: ownerId,
    },
  });

  // —— PO 2: Lubricants Plus — fully received, 2 oil/coolant lines ——
  const po2 = await prisma.purchaseOrder.create({
    data: {
      id: "seed_po_02",
      garageId,
      vendorId: "seed_vendor_02",
      number: "PO-SEED-0002",
      status: "RECEIVED",
      notes: "Monthly fluids order",
      createdById: ownerId,
      lines: {
        create: [
          {
            id: "seed_pol_02a",
            garageId,
            partId: parts.seed_part_oil.id,
            quantityOrdered: 20,
            quantityReceived: 20,
            unitCostPaise: parts.seed_part_oil.purchasePricePaise,
            sortOrder: 0,
          },
          {
            id: "seed_pol_02b",
            garageId,
            partId: parts.seed_part_coolant.id,
            quantityOrdered: 10,
            quantityReceived: 10,
            unitCostPaise: parts.seed_part_coolant.purchasePricePaise,
            sortOrder: 1,
          },
        ],
      },
    },
  });

  await prisma.partsRequest.createMany({
    data: [
      {
        id: "seed_pr_ord_04",
        garageId,
        partId: parts.seed_part_oil.id,
        quantity: 20,
        status: "ORDERED",
        notes: "Engine oil drum top-up",
        purchaseOrderId: po2.id,
        createdById: ownerId,
      },
      {
        id: "seed_pr_ord_05",
        garageId,
        partId: parts.seed_part_coolant.id,
        quantity: 10,
        status: "ORDERED",
        notes: "Coolant for summer",
        purchaseOrderId: po2.id,
        createdById: ownerId,
      },
    ],
  });

  await prisma.goodsReceipt.create({
    data: {
      id: "seed_gr_02",
      garageId,
      purchaseOrderId: po2.id,
      notes: "Full delivery from Lubricants Plus",
      createdById: ownerId,
      lines: {
        create: [
          {
            id: "seed_grl_02a",
            garageId,
            purchaseOrderLineId: "seed_pol_02a",
            partId: parts.seed_part_oil.id,
            quantity: 20,
          },
          {
            id: "seed_grl_02b",
            garageId,
            purchaseOrderLineId: "seed_pol_02b",
            partId: parts.seed_part_coolant.id,
            quantity: 10,
          },
        ],
      },
    },
  });

  await prisma.stockMovement.createMany({
    data: [
      {
        id: "seed_sm_recv_02a",
        garageId,
        partId: parts.seed_part_oil.id,
        type: "IN",
        quantityChange: 20,
        note: "Seed PO-SEED-0002 receipt",
        goodsReceiptLineId: "seed_grl_02a",
        createdById: ownerId,
      },
      {
        id: "seed_sm_recv_02b",
        garageId,
        partId: parts.seed_part_coolant.id,
        type: "IN",
        quantityChange: 10,
        note: "Seed PO-SEED-0002 receipt",
        goodsReceiptLineId: "seed_grl_02b",
        createdById: ownerId,
      },
    ],
  });

  const bill2Amount =
    20 * parts.seed_part_oil.purchasePricePaise +
    10 * parts.seed_part_coolant.purchasePricePaise;

  const bill2 = await prisma.vendorBill.create({
    data: {
      id: "seed_vb_02",
      garageId,
      vendorId: "seed_vendor_02",
      purchaseOrderId: po2.id,
      billNumber: "LP-8821",
      billDate: daysFromNow(-8),
      amountPaise: bill2Amount,
      notes: "Fully paid fluids bill",
      createdById: ownerId,
    },
  });

  await prisma.vendorBillPayment.create({
    data: {
      id: "seed_vbp_02",
      garageId,
      vendorBillId: bill2.id,
      amountPaise: bill2Amount,
      method: "CASH",
      paidAt: daysFromNow(-6),
      notes: "Paid in full at counter",
      createdById: ownerId,
    },
  });

  await prisma.purchaseReturn.create({
    data: {
      id: "seed_ret_02",
      garageId,
      vendorId: "seed_vendor_02",
      vendorBillId: bill2.id,
      partId: parts.seed_part_oil.id,
      quantity: 1,
      creditPaise: parts.seed_part_oil.purchasePricePaise,
      notes: "One litre seal leak — credit note with vendor",
      createdById: ownerId,
    },
  });
  await prisma.stockMovement.create({
    data: {
      id: "seed_sm_ret_02",
      garageId,
      partId: parts.seed_part_oil.id,
      type: "OUT",
      quantityChange: -1,
      note: "Seed purchase return",
      purchaseReturnId: "seed_ret_02",
      createdById: ownerId,
    },
  });

  // —— PO 3: Battery World — pending, not received ——
  const po3 = await prisma.purchaseOrder.create({
    data: {
      id: "seed_po_03",
      garageId,
      vendorId: "seed_vendor_03",
      number: "PO-SEED-0003",
      status: "PENDING",
      notes: "Awaiting delivery next week",
      createdById: ownerId,
      lines: {
        create: [
          {
            id: "seed_pol_03a",
            garageId,
            partId: parts.seed_part_battery.id,
            quantityOrdered: 2,
            quantityReceived: 0,
            unitCostPaise: parts.seed_part_battery.purchasePricePaise,
            sortOrder: 0,
          },
        ],
      },
    },
  });

  await prisma.partsRequest.create({
    data: {
      id: "seed_pr_ord_06",
      garageId,
      partId: parts.seed_part_battery.id,
      quantity: 2,
      status: "ORDERED",
      notes: "Two 35Ah for stock",
      purchaseOrderId: po3.id,
      createdById: ownerId,
    },
  });

  // —— Extra unpaid bill (no PO) for Auto Parts Hub ——
  await prisma.vendorBill.create({
    data: {
      id: "seed_vb_03",
      garageId,
      vendorId: "seed_vendor_01",
      billNumber: "APH-INV-2388",
      billDate: daysFromNow(-20),
      amountPaise: 85000,
      notes: "Walk-in small parts — outstanding",
      createdById: ownerId,
    },
  });

  // —— City Tyres: small paid bill + return without PO ——
  const bill4 = await prisma.vendorBill.create({
    data: {
      id: "seed_vb_04",
      garageId,
      vendorId: "seed_vendor_04",
      billNumber: "CT-119",
      billDate: daysFromNow(-12),
      amountPaise: 5 * parts.seed_part_wiper.purchasePricePaise,
      notes: "Wiper blades cash purchase",
      createdById: ownerId,
    },
  });
  await prisma.vendorBillPayment.create({
    data: {
      id: "seed_vbp_04",
      garageId,
      vendorBillId: bill4.id,
      amountPaise: 5 * parts.seed_part_wiper.purchasePricePaise,
      method: "CASH",
      paidAt: daysFromNow(-12),
      createdById: ownerId,
    },
  });
  await prisma.stockMovement.create({
    data: {
      id: "seed_sm_open_wiper_extra",
      garageId,
      partId: parts.seed_part_wiper.id,
      type: "IN",
      quantityChange: 5,
      note: "Seed walk-in purchase stock",
      createdById: ownerId,
    },
  });
  await prisma.purchaseReturn.create({
    data: {
      id: "seed_ret_03",
      garageId,
      vendorId: "seed_vendor_04",
      vendorBillId: bill4.id,
      partId: parts.seed_part_wiper.id,
      quantity: 1,
      creditPaise: parts.seed_part_wiper.purchasePricePaise,
      notes: "Wrong size returned same day",
      createdById: ownerId,
    },
  });
  await prisma.stockMovement.create({
    data: {
      id: "seed_sm_ret_03",
      garageId,
      partId: parts.seed_part_wiper.id,
      type: "OUT",
      quantityChange: -1,
      note: "Seed purchase return",
      purchaseReturnId: "seed_ret_03",
      createdById: ownerId,
    },
  });

  await prisma.purchaseOrderNumberCounter.upsert({
    where: { garageId },
    create: { garageId, lastNumber: 3 },
    update: { lastNumber: 3 },
  });
}

async function seedInventorySales({ garageId, ownerId }) {
  const partIds = [
    "seed_part_oil",
    "seed_part_pads",
    "seed_part_filter",
    "seed_part_plugs",
    "seed_part_wiper",
    "seed_part_coolant",
  ];
  let catalog = await prisma.part.findMany({
    where: { garageId, id: { in: partIds } },
  });

  if (catalog.length === 0) {
    // Vendors module was skipped — still give sales something to sell.
    const fallback = [
      {
        id: "seed_part_oil",
        name: "Engine oil 5W-30",
        sku: "SEED-OIL-5W30",
        unit: "L",
        purchasePricePaise: 45000,
        sellingPricePaise: 65000,
        opening: 30,
      },
      {
        id: "seed_part_pads",
        name: "Brake pad set (front)",
        sku: "SEED-BRK-PAD-F",
        unit: "set",
        purchasePricePaise: 120000,
        sellingPricePaise: 180000,
        opening: 12,
      },
      {
        id: "seed_part_filter",
        name: "Air filter",
        sku: "SEED-AIR-FLT",
        unit: "pcs",
        purchasePricePaise: 25000,
        sellingPricePaise: 40000,
        opening: 20,
      },
      {
        id: "seed_part_wiper",
        name: "Wiper blade 24in",
        sku: "SEED-WIP-24",
        unit: "pcs",
        purchasePricePaise: 18000,
        sellingPricePaise: 32000,
        opening: 15,
      },
    ];
    for (const spec of fallback) {
      await prisma.part.create({
        data: {
          id: spec.id,
          garageId,
          name: spec.name,
          sku: spec.sku,
          unit: spec.unit,
          purchasePricePaise: spec.purchasePricePaise,
          sellingPricePaise: spec.sellingPricePaise,
          gstRatePercent: 18,
          hsn: PART_HSN,
          lowStockLevel: 2,
        },
      });
      await prisma.stockMovement.create({
        data: {
          id: `seed_sm_sale_open_${spec.id.replace("seed_part_", "")}`,
          garageId,
          partId: spec.id,
          type: "IN",
          quantityChange: spec.opening,
          note: "Seed stock for counter sales",
          createdById: ownerId,
        },
      });
    }
    catalog = await prisma.part.findMany({
      where: { garageId, id: { in: fallback.map((p) => p.id) } },
    });
  }

  const byId = Object.fromEntries(catalog.map((p) => [p.id, p]));
  const oil = byId.seed_part_oil;
  const pads = byId.seed_part_pads;
  const filter = byId.seed_part_filter;
  const plugs = byId.seed_part_plugs;
  const wiper = byId.seed_part_wiper;
  const coolant = byId.seed_part_coolant;

  const sales = [
    {
      id: "seed_sale_01",
      customerId: "seed_cust_01",
      walkInName: null,
      notes: "Counter sale — oil + filter for Swift",
      createdAt: daysFromNow(-2),
      lines: [
        oil && {
          id: "seed_sale_01_l1",
          part: oil,
          quantity: 4,
        },
        filter && {
          id: "seed_sale_01_l2",
          part: filter,
          quantity: 1,
        },
      ].filter(Boolean),
    },
    {
      id: "seed_sale_02",
      customerId: "seed_cust_02",
      walkInName: null,
      notes: "Company car — brake pads",
      createdAt: daysFromNow(-4),
      lines: [
        pads && {
          id: "seed_sale_02_l1",
          part: pads,
          quantity: 1,
        },
        plugs && {
          id: "seed_sale_02_l2",
          part: plugs,
          quantity: 4,
        },
      ].filter(Boolean),
    },
    {
      id: "seed_sale_03",
      customerId: null,
      walkInName: "Walk-in — Rajesh",
      notes: "Cash walk-in",
      createdAt: daysFromNow(-1),
      lines: [
        wiper && {
          id: "seed_sale_03_l1",
          part: wiper,
          quantity: 2,
        },
        oil && {
          id: "seed_sale_03_l2",
          part: oil,
          quantity: 2,
        },
      ].filter(Boolean),
    },
    {
      id: "seed_sale_04",
      customerId: "seed_cust_03",
      walkInName: null,
      notes: "Coolant top-up kit",
      createdAt: daysFromNow(-6),
      lines: [
        coolant && {
          id: "seed_sale_04_l1",
          part: coolant,
          quantity: 2,
        },
        filter && {
          id: "seed_sale_04_l2",
          part: filter,
          quantity: 2,
        },
      ].filter(Boolean),
    },
    {
      id: "seed_sale_05",
      customerId: null,
      walkInName: "Walk-in — Anonymous",
      notes: null,
      createdAt: daysFromNow(-3),
      lines: [
        plugs && {
          id: "seed_sale_05_l1",
          part: plugs,
          quantity: 2,
        },
      ].filter(Boolean),
    },
    {
      id: "seed_sale_06",
      customerId: "seed_cust_05",
      walkInName: null,
      notes: "Multi-part counter bill",
      createdAt: daysFromNow(-7),
      lines: [
        oil && {
          id: "seed_sale_06_l1",
          part: oil,
          quantity: 5,
        },
        pads && {
          id: "seed_sale_06_l2",
          part: pads,
          quantity: 1,
        },
        wiper && {
          id: "seed_sale_06_l3",
          part: wiper,
          quantity: 1,
        },
      ].filter(Boolean),
    },
  ].filter((sale) => sale.lines.length > 0);

  for (const sale of sales) {
    await prisma.directSale.create({
      data: {
        id: sale.id,
        garageId,
        customerId: sale.customerId,
        walkInName: sale.walkInName,
        notes: sale.notes,
        createdById: ownerId,
        createdAt: sale.createdAt,
        lines: {
          create: sale.lines.map((line, index) => ({
            id: line.id,
            garageId,
            partId: line.part.id,
            quantity: line.quantity,
            unitPricePaise: line.part.sellingPricePaise,
            gstRatePercent: line.part.gstRatePercent,
            hsn: line.part.hsn,
            sortOrder: index,
          })),
        },
      },
    });

    for (const line of sale.lines) {
      await prisma.stockMovement.create({
        data: {
          id: `seed_sm_sale_${line.id}`,
          garageId,
          partId: line.part.id,
          type: "OUT",
          quantityChange: -line.quantity,
          note: "Seed direct sale",
          directSaleId: sale.id,
          directSaleLineId: line.id,
          createdById: ownerId,
          createdAt: sale.createdAt,
        },
      });
    }
  }
}

const MODULE_SEEDS = [
  {
    key: "vendors-and-purchases",
    // Empty module = no vendors yet for this garage.
    isEmpty: async (garageId) =>
      (await prisma.vendor.count({ where: { garageId } })) === 0,
    clear: clearVendorsPurchasesSeed,
    seed: seedVendorsAndPurchases,
  },
  {
    key: "inventory-sales",
    isEmpty: async (garageId) =>
      (await prisma.directSale.count({ where: { garageId } })) === 0,
    clear: clearDirectSalesSeed,
    seed: seedInventorySales,
  },
];

async function ensureTeam(garageId, ownerId) {
  const tech1 = await prisma.user.upsert({
    where: { email: "seed.tech1@yopmail.com" },
    update: { garageId, role: "TECHNICIAN", name: "Ravi Patel" },
    create: {
      id: "seed_user_tech1",
      email: "seed.tech1@yopmail.com",
      name: "Ravi Patel",
      role: "TECHNICIAN",
      garageId,
      emailVerified: new Date(),
    },
  });

  const tech2 = await prisma.user.upsert({
    where: { email: "seed.tech2@yopmail.com" },
    update: { garageId, role: "TECHNICIAN", name: "Amit Shah" },
    create: {
      id: "seed_user_tech2",
      email: "seed.tech2@yopmail.com",
      name: "Amit Shah",
      role: "TECHNICIAN",
      garageId,
      emailVerified: new Date(),
    },
  });

  const accountant = await prisma.user.upsert({
    where: { email: "seed.accounts@yopmail.com" },
    update: { garageId, role: "ACCOUNTANT", name: "Neha Desai" },
    create: {
      id: "seed_user_accountant",
      email: "seed.accounts@yopmail.com",
      name: "Neha Desai",
      role: "ACCOUNTANT",
      garageId,
      emailVerified: new Date(),
    },
  });

  await prisma.invite.upsert({
    where: { id: "seed_invite_pending" },
    update: {},
    create: {
      id: "seed_invite_pending",
      garageId,
      email: "seed.invitee@yopmail.com",
      role: "TECHNICIAN",
      tokenHash: "seed_invite_token_hash_not_for_login",
      invitedBy: ownerId,
      locale: "en",
      expiresAt: daysFromNow(7),
      lastEmailStatus: "sent",
      lastEmailAt: new Date(),
    },
  });

  return { tech1, tech2, accountant };
}

async function seedCustomersAndVehicles(garageId) {
  const customers = [
    {
      id: "seed_cust_01",
      name: "Kiran Mehta",
      phone: "9876501001",
      address: "Adajan, Surat",
      notes: "Prefers WhatsApp updates. Regular for oil service.",
      vehicles: [
        {
          id: "seed_veh_01",
          registrationNumber: "GJ05AB1234",
          make: "Maruti Suzuki",
          model: "Swift VXI",
          year: 2019,
          odometer: 48200,
          insuranceExpiry: daysFromNow(40),
          pucExpiry: daysFromNow(-5),
          fitnessExpiry: daysFromNow(200),
        },
        {
          id: "seed_veh_02",
          registrationNumber: "GJ05CD5678",
          make: "Hyundai",
          model: "i20 Sportz",
          year: 2021,
          odometer: 22150,
          insuranceExpiry: daysFromNow(120),
          pucExpiry: daysFromNow(60),
        },
      ],
    },
    {
      id: "seed_cust_02",
      name: "Fatima Khan",
      phone: "9876501002",
      address: "Vesu, Surat",
      notes: "Company car — send GST invoice to accounts.",
      vehicles: [
        {
          id: "seed_veh_03",
          registrationNumber: "GJ05EF9012",
          make: "Honda",
          model: "City ZX",
          year: 2020,
          odometer: 61500,
          insuranceExpiry: daysFromNow(15),
          pucExpiry: daysFromNow(30),
          fitnessExpiry: daysFromNow(90),
        },
      ],
    },
    {
      id: "seed_cust_03",
      name: "Jayesh Solanki",
      phone: "9876501003",
      address: "Katargam, Surat",
      notes: null,
      vehicles: [
        {
          id: "seed_veh_04",
          registrationNumber: "GJ05GH3456",
          make: "Tata",
          model: "Nexon EV",
          year: 2023,
          odometer: 9800,
          insuranceExpiry: daysFromNow(300),
          pucExpiry: daysFromNow(180),
        },
      ],
    },
    {
      id: "seed_cust_04",
      name: "Priya Sharma",
      phone: "9876501004",
      address: "Athwa, Surat",
      notes: "Sensitive to brake noise — follow up after delivery.",
      vehicles: [
        {
          id: "seed_veh_05",
          registrationNumber: "GJ05IJ7890",
          make: "Mahindra",
          model: "XUV700 AX7",
          year: 2022,
          odometer: 35400,
          insuranceExpiry: daysFromNow(8),
          pucExpiry: daysFromNow(45),
          fitnessExpiry: daysFromNow(400),
        },
      ],
    },
    {
      id: "seed_cust_05",
      name: "Ramesh Gohil",
      phone: "9876501005",
      address: "Varachha, Surat",
      notes: "Walk-in lead converted last month.",
      vehicles: [
        {
          id: "seed_veh_06",
          registrationNumber: "GJ05KL1122",
          make: "Toyota",
          model: "Innova Crysta",
          year: 2018,
          odometer: 89200,
          insuranceExpiry: daysFromNow(-20),
          pucExpiry: daysFromNow(10),
          fitnessExpiry: daysFromNow(60),
        },
      ],
    },
  ];

  for (const c of customers) {
    const { vehicles, ...cust } = c;
    await prisma.customer.create({
      data: { ...cust, garageId },
    });
    for (const v of vehicles) {
      await prisma.vehicle.create({
        data: { ...v, garageId, customerId: cust.id },
      });
    }
  }

  return customers;
}

async function createChecklist(inspectionId, garageId, results) {
  for (let i = 0; i < CHECKLIST.length; i++) {
    const item = CHECKLIST[i];
    const result = results[item.key] ?? null;
    await prisma.inspectionItem.create({
      data: {
        id: `seed_ii_${inspectionId.slice(-6)}_${item.key}`,
        garageId,
        inspectionId,
        key: item.key,
        label: item.label,
        result: result?.result ?? null,
        notes: result?.notes ?? null,
        sortOrder: i,
        isCustom: false,
      },
    });
  }
}

async function seedOrders({ garageId, ownerId, tech1, tech2 }) {
  /** @type {Array<Record<string, unknown>>} */
  const specs = [
    {
      id: "seed_so_waiting",
      customerId: "seed_cust_01",
      vehicleId: "seed_veh_01",
      status: "WAITING",
      priority: "NORMAL",
      complaint: "Periodic service due — oil change and general check.",
      requestedServices: "Engine oil, filter, cabin filter",
      odometerIn: 48200,
      expectedCompletion: hoursFromNow(6),
      technicianId: null,
      bay: null,
      lines: [
        {
          id: "seed_sol_w1",
          type: "LABOUR",
          description: "Periodic service labour",
          quantity: 1,
          unitPricePaise: 120000,
        },
        {
          id: "seed_sol_w2",
          type: "PART",
          description: "Engine oil 4L (synthetic)",
          quantity: 1,
          unitPricePaise: 280000,
        },
      ],
    },
    {
      id: "seed_so_inspection",
      customerId: "seed_cust_02",
      vehicleId: "seed_veh_03",
      status: "INSPECTION",
      priority: "HIGH",
      complaint: "Brake pedal soft; squeal on low speed. Check pads and discs.",
      requestedServices: "Brake inspection",
      odometerIn: 61500,
      expectedCompletion: hoursFromNow(4),
      technicianId: tech1.id,
      bay: "Bay 1",
      lines: [
        {
          id: "seed_sol_i1",
          type: "LABOUR",
          description: "Brake inspection labour",
          quantity: 1,
          unitPricePaise: 80000,
        },
      ],
      inspection: {
        id: "seed_insp_01",
        notes: "Front pads thin; rear OK. Disc scoring on left front.",
        results: {
          brakes: {
            result: "URGENT",
            notes: "Front pads ~2mm; replace both sides.",
          },
          tyres: { result: "OK", notes: null },
          battery: { result: "OK", notes: null },
          lights: { result: "NEEDS_ATTENTION", notes: "LH headlamp misted." },
          fluids: { result: "OK", notes: null },
          suspension: { result: "OK", notes: null },
          ac: { result: "OK", notes: null },
        },
        repairs: [
          {
            id: "seed_sr_01",
            type: "LABOUR",
            description: "Replace front brake pads",
            quantity: 1,
            unitPricePaise: 150000,
          },
          {
            id: "seed_sr_02",
            type: "PART",
            description: "Front brake pad set (City)",
            quantity: 1,
            unitPricePaise: 320000,
          },
          {
            id: "seed_sr_03",
            type: "LABOUR",
            description: "Resurface / replace LH disc if needed",
            quantity: 1,
            unitPricePaise: 200000,
          },
        ],
      },
      estimate: {
        revision1: {
          id: "seed_est_01_r1",
          notes: "Initial quote — pads only",
          superseded: true,
          lines: [
            {
              id: "seed_el_01_r1_a",
              type: "LABOUR",
              description: "Replace front brake pads",
              quantity: 1,
              unitPricePaise: 150000,
              gstRatePercent: 18,
              hsnOrSac: LABOUR_SAC,
              approvalState: "APPROVED",
            },
            {
              id: "seed_el_01_r1_b",
              type: "PART",
              description: "Front brake pad set",
              quantity: 1,
              unitPricePaise: 320000,
              gstRatePercent: 18,
              hsnOrSac: PART_HSN,
              approvalState: "APPROVED",
            },
          ],
        },
        revision2: {
          id: "seed_est_01_r2",
          notes: "Revised after disc check — customer approved pads + disc",
          superseded: false,
          lines: [
            {
              id: "seed_el_01_r2_a",
              type: "LABOUR",
              description: "Replace front brake pads",
              quantity: 1,
              unitPricePaise: 150000,
              gstRatePercent: 18,
              hsnOrSac: LABOUR_SAC,
              approvalState: "APPROVED",
            },
            {
              id: "seed_el_01_r2_b",
              type: "PART",
              description: "Front brake pad set (City)",
              quantity: 1,
              unitPricePaise: 320000,
              gstRatePercent: 18,
              hsnOrSac: PART_HSN,
              approvalState: "APPROVED",
            },
            {
              id: "seed_el_01_r2_c",
              type: "LABOUR",
              description: "Replace LH front disc",
              quantity: 1,
              unitPricePaise: 220000,
              gstRatePercent: 18,
              hsnOrSac: LABOUR_SAC,
              approvalState: "APPROVED",
            },
            {
              id: "seed_el_01_r2_d",
              type: "PART",
              description: "Brake disc LH front",
              quantity: 1,
              unitPricePaise: 450000,
              gstRatePercent: 28,
              hsnOrSac: PART_HSN,
              approvalState: "PENDING",
            },
          ],
        },
      },
    },
    {
      id: "seed_so_progress",
      customerId: "seed_cust_04",
      vehicleId: "seed_veh_05",
      status: "IN_PROGRESS",
      priority: "URGENT",
      complaint: "AC not cooling; unusual noise from compressor area.",
      requestedServices: "AC diagnosis and repair",
      odometerIn: 35400,
      expectedCompletion: hoursFromNow(-2),
      technicianId: tech2.id,
      bay: "Bay 2",
      lines: [
        {
          id: "seed_sol_p1",
          type: "LABOUR",
          description: "AC diagnosis",
          quantity: 1,
          unitPricePaise: 100000,
        },
        {
          id: "seed_sol_p2",
          type: "PART",
          description: "AC gas R134a top-up",
          quantity: 1,
          unitPricePaise: 180000,
        },
      ],
      inspection: {
        id: "seed_insp_02",
        notes: "Low gas; condenser fins clogged with dust.",
        results: {
          brakes: { result: "OK", notes: null },
          tyres: { result: "NEEDS_ATTENTION", notes: "Rear right low pressure." },
          battery: { result: "OK", notes: null },
          lights: { result: "OK", notes: null },
          fluids: { result: "OK", notes: null },
          suspension: { result: "OK", notes: null },
          ac: {
            result: "URGENT",
            notes: "Compressor clutch intermittently engaging.",
          },
        },
        repairs: [
          {
            id: "seed_sr_04",
            type: "LABOUR",
            description: "AC leak check + gas recharge",
            quantity: 1,
            unitPricePaise: 250000,
          },
          {
            id: "seed_sr_05",
            type: "PART",
            description: "AC compressor (XUV700)",
            quantity: 1,
            unitPricePaise: 1850000,
          },
        ],
      },
      estimate: {
        revision1: {
          id: "seed_est_02_r1",
          notes: "Customer asked to approve labour first; compressor pending",
          superseded: false,
          lines: [
            {
              id: "seed_el_02_a",
              type: "LABOUR",
              description: "AC leak check + gas recharge",
              quantity: 1,
              unitPricePaise: 250000,
              gstRatePercent: 18,
              hsnOrSac: LABOUR_SAC,
              approvalState: "APPROVED",
            },
            {
              id: "seed_el_02_b",
              type: "PART",
              description: "AC compressor (XUV700)",
              quantity: 1,
              unitPricePaise: 1850000,
              gstRatePercent: 18,
              hsnOrSac: PART_HSN,
              approvalState: "REJECTED",
            },
            {
              id: "seed_el_02_c",
              type: "PART",
              description: "AC gas R134a",
              quantity: 1,
              unitPricePaise: 180000,
              gstRatePercent: 18,
              hsnOrSac: PART_HSN,
              approvalState: "APPROVED",
            },
          ],
        },
      },
    },
    {
      id: "seed_so_parts",
      customerId: "seed_cust_03",
      vehicleId: "seed_veh_04",
      status: "WAITING_FOR_PARTS",
      priority: "NORMAL",
      complaint: "Charging slow; 12V battery warning on dash.",
      requestedServices: "EV 12V battery check",
      odometerIn: 9800,
      expectedCompletion: daysFromNow(1),
      technicianId: tech1.id,
      bay: "Bay 3",
      lines: [
        {
          id: "seed_sol_wp1",
          type: "LABOUR",
          description: "Battery diagnosis",
          quantity: 1,
          unitPricePaise: 90000,
        },
        {
          id: "seed_sol_wp2",
          type: "PART",
          description: "12V auxiliary battery (Nexon EV)",
          quantity: 1,
          unitPricePaise: 750000,
        },
      ],
      inspection: {
        id: "seed_insp_03",
        notes: "12V battery failing load test. Ordered OEM unit.",
        results: {
          brakes: { result: "OK", notes: null },
          tyres: { result: "OK", notes: null },
          battery: {
            result: "URGENT",
            notes: "Load test failed at 10.8V.",
          },
          lights: { result: "OK", notes: null },
          fluids: { result: "OK", notes: null },
          suspension: { result: "OK", notes: null },
          ac: { result: "OK", notes: null },
        },
        repairs: [
          {
            id: "seed_sr_06",
            type: "PART",
            description: "12V auxiliary battery",
            quantity: 1,
            unitPricePaise: 750000,
          },
        ],
      },
      estimate: {
        revision1: {
          id: "seed_est_03_r1",
          notes: "Awaiting part arrival from vendor",
          superseded: false,
          lines: [
            {
              id: "seed_el_03_a",
              type: "LABOUR",
              description: "Battery diagnosis & fitment",
              quantity: 1,
              unitPricePaise: 120000,
              gstRatePercent: 18,
              hsnOrSac: LABOUR_SAC,
              approvalState: "APPROVED",
            },
            {
              id: "seed_el_03_b",
              type: "PART",
              description: "12V auxiliary battery (Nexon EV)",
              quantity: 1,
              unitPricePaise: 750000,
              gstRatePercent: 18,
              hsnOrSac: PART_HSN,
              approvalState: "APPROVED",
            },
          ],
        },
      },
    },
    {
      id: "seed_so_ready",
      customerId: "seed_cust_01",
      vehicleId: "seed_veh_02",
      status: "READY",
      priority: "LOW",
      complaint: "Wheel alignment and tyre rotation.",
      requestedServices: "Alignment + balance",
      odometerIn: 22150,
      expectedCompletion: hoursFromNow(1),
      technicianId: tech2.id,
      bay: "Bay 1",
      lines: [
        {
          id: "seed_sol_r1",
          type: "LABOUR",
          description: "Four-wheel alignment",
          quantity: 1,
          unitPricePaise: 150000,
        },
        {
          id: "seed_sol_r2",
          type: "LABOUR",
          description: "Tyre rotation and balance",
          quantity: 1,
          unitPricePaise: 80000,
        },
      ],
      inspection: {
        id: "seed_insp_04",
        notes: "All checks OK after alignment.",
        results: {
          brakes: { result: "OK", notes: null },
          tyres: { result: "OK", notes: "Rotated FL→RL pattern." },
          battery: { result: "OK", notes: null },
          lights: { result: "OK", notes: null },
          fluids: { result: "OK", notes: null },
          suspension: { result: "OK", notes: null },
          ac: { result: "OK", notes: null },
        },
        repairs: [],
      },
      estimate: {
        revision1: {
          id: "seed_est_04_r1",
          notes: "Ready for delivery — full approval",
          superseded: false,
          lines: [
            {
              id: "seed_el_04_a",
              type: "LABOUR",
              description: "Four-wheel alignment",
              quantity: 1,
              unitPricePaise: 150000,
              gstRatePercent: 18,
              hsnOrSac: LABOUR_SAC,
              approvalState: "APPROVED",
            },
            {
              id: "seed_el_04_b",
              type: "LABOUR",
              description: "Tyre rotation and balance",
              quantity: 1,
              unitPricePaise: 80000,
              gstRatePercent: 18,
              hsnOrSac: LABOUR_SAC,
              approvalState: "APPROVED",
            },
          ],
        },
      },
    },
    {
      id: "seed_so_done",
      customerId: "seed_cust_05",
      vehicleId: "seed_veh_06",
      status: "COMPLETED",
      priority: "NORMAL",
      complaint: "Clutch slipping on highway; hard to engage 3rd gear.",
      requestedServices: "Clutch overhaul",
      odometerIn: 89150,
      expectedCompletion: daysFromNow(-2),
      technicianId: tech1.id,
      bay: "Bay 2",
      lines: [
        {
          id: "seed_sol_d1",
          type: "LABOUR",
          description: "Clutch kit replacement labour",
          quantity: 1,
          unitPricePaise: 450000,
        },
        {
          id: "seed_sol_d2",
          type: "PART",
          description: "Clutch kit (Innova Crysta)",
          quantity: 1,
          unitPricePaise: 1250000,
        },
      ],
      inspection: {
        id: "seed_insp_05",
        notes: "Clutch worn; flywheel resurfaced. Delivered.",
        results: {
          brakes: { result: "NEEDS_ATTENTION", notes: "Pads at 40% — advise next visit." },
          tyres: { result: "OK", notes: null },
          battery: { result: "OK", notes: null },
          lights: { result: "OK", notes: null },
          fluids: { result: "OK", notes: null },
          suspension: { result: "OK", notes: null },
          ac: { result: "OK", notes: null },
        },
        repairs: [
          {
            id: "seed_sr_07",
            type: "LABOUR",
            description: "Clutch kit replacement",
            quantity: 1,
            unitPricePaise: 450000,
          },
          {
            id: "seed_sr_08",
            type: "PART",
            description: "Clutch kit (Innova Crysta)",
            quantity: 1,
            unitPricePaise: 1250000,
          },
        ],
      },
      estimate: {
        revision1: {
          id: "seed_est_05_r1",
          notes: "Completed job — paid in full (billing module later)",
          superseded: false,
          lines: [
            {
              id: "seed_el_05_a",
              type: "LABOUR",
              description: "Clutch kit replacement labour",
              quantity: 1,
              unitPricePaise: 450000,
              gstRatePercent: 18,
              hsnOrSac: LABOUR_SAC,
              approvalState: "APPROVED",
            },
            {
              id: "seed_el_05_b",
              type: "PART",
              description: "Clutch kit (Innova Crysta)",
              quantity: 1,
              unitPricePaise: 1250000,
              gstRatePercent: 18,
              hsnOrSac: PART_HSN,
              approvalState: "APPROVED",
            },
          ],
        },
      },
    },
  ];

  for (const spec of specs) {
    const {
      lines,
      inspection,
      estimate,
      ...order
    } = spec;

    await prisma.serviceOrder.create({
      data: { ...order, garageId },
    });

    let sort = 0;
    for (const line of lines) {
      await prisma.serviceOrderLine.create({
        data: {
          ...line,
          garageId,
          serviceOrderId: order.id,
          sortOrder: sort++,
        },
      });
    }

    if (inspection) {
      await prisma.inspection.create({
        data: {
          id: inspection.id,
          garageId,
          serviceOrderId: order.id,
          notes: inspection.notes,
        },
      });
      await createChecklist(inspection.id, garageId, inspection.results);
      let rSort = 0;
      for (const repair of inspection.repairs) {
        await prisma.suggestedRepair.create({
          data: {
            ...repair,
            garageId,
            inspectionId: inspection.id,
            sortOrder: rSort++,
          },
        });
      }
    }

    if (estimate) {
      const revisions = [estimate.revision1, estimate.revision2].filter(Boolean);
      let revNo = 1;
      for (const rev of revisions) {
        await prisma.estimate.create({
          data: {
            id: rev.id,
            garageId,
            serviceOrderId: order.id,
            revisionNumber: revNo,
            notes: rev.notes,
            supersededAt: rev.superseded ? daysFromNow(-1) : null,
            createdById: ownerId,
          },
        });
        let lSort = 0;
        for (const line of rev.lines) {
          await prisma.estimateLine.create({
            data: {
              ...line,
              garageId,
              estimateId: rev.id,
              sortOrder: lSort++,
            },
          });

          if (line.approvalState !== "PENDING") {
            await prisma.estimateApproval.create({
              data: {
                id: `seed_ea_${line.id}`,
                garageId,
                estimateId: rev.id,
                estimateLineId: line.id,
                fromState: "PENDING",
                toState: line.approvalState,
                method: line.approvalState === "REJECTED" ? "PHONE" : "MANUAL",
                recordedById: ownerId,
                note:
                  line.approvalState === "REJECTED"
                    ? "Customer wants second opinion on compressor price"
                    : "Approved on floor",
              },
            });
          }
        }
        revNo += 1;
      }
    }
  }

  return specs.length;
}

async function seedAudit(garageId, ownerId) {
  const rows = [
    {
      id: "seed_audit_01",
      action: "estimate.line_approved",
      entity: "EstimateLine",
      entityId: "seed_el_01_r2_a",
      meta: { method: "MANUAL", demo: true },
    },
    {
      id: "seed_audit_02",
      action: "estimate.line_rejected",
      entity: "EstimateLine",
      entityId: "seed_el_02_b",
      meta: { method: "PHONE", demo: true },
    },
    {
      id: "seed_audit_03",
      action: "service_order.status_changed",
      entity: "ServiceOrder",
      entityId: "seed_so_ready",
      meta: { from: "IN_PROGRESS", to: "READY", demo: true },
    },
  ];

  for (const row of rows) {
    await prisma.auditLog.create({
      data: {
        ...row,
        garageId,
        actorId: ownerId,
      },
    });
  }
}

async function main() {
  const garage = await resolveGarage();
  console.log(`Seeding garage: ${garage.name} (${garage.id})`);

  await prisma.garage.update({
    where: { id: garage.id },
    data: {
      name: garage.name === "prime" ? "Prime Motors" : garage.name,
      address: garage.address ?? "12 Ring Road, Surat, Gujarat 395007",
      gstin: garage.gstin ?? "24ABCDE1234F1Z5",
    },
  });

  await clearPreviousSeed(garage.id);

  let owner = await prisma.user.findFirst({
    where: { garageId: garage.id, role: "OWNER" },
    orderBy: { createdAt: "asc" },
  });

  if (!owner) {
    owner = await prisma.user.create({
      data: {
        id: "seed_user_owner",
        email: "seed.owner@yopmail.com",
        name: "Seed Owner",
        role: "OWNER",
        garageId: garage.id,
        emailVerified: new Date(),
      },
    });
    console.log(
      `Created owner: ${owner.email} (sign in with OTP / your auth flow)`,
    );
  }

  const team = await ensureTeam(garage.id, owner.id);
  await seedCustomersAndVehicles(garage.id);
  const orderCount = await seedOrders({
    garageId: garage.id,
    ownerId: owner.id,
    tech1: team.tech1,
    tech2: team.tech2,
  });
  await seedAudit(garage.id, owner.id);

  const moduleResults = [];
  for (const seedDef of MODULE_SEEDS) {
    const ran = await seedModuleOnce(garage.id, owner.id, seedDef);
    moduleResults.push(`${seedDef.key}: ${ran ? "seeded" : "skipped"}`);
  }

  console.log(`Done.
  Customers: 5 (+ vehicles)
  Service orders: ${orderCount} (all statuses)
  Team seed users: seed.tech1@yopmail.com, seed.tech2@yopmail.com, seed.accounts@yopmail.com
  Pending invite: seed.invitee@yopmail.com
  Modules: ${moduleResults.join("; ") || "none"}
  Vendors demo (when seeded): 4 vendors, 8 parts, requests, 3 POs, bills, payments, returns
  Inventory sales (when seeded): 6 counter sales (customers + walk-ins)
  Log in as: ${owner.email}
  Not seeded yet: reminders, appointments, AMC`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import "server-only";

import { prisma } from "@/lib/db";

const PURCHASE_GST_EXPORT_CAP = 2_000;

/** Outside-work lines with input GST > 0% in [from, toExclusive) by createdAt. */
export async function listOutsideWorkForPurchaseGstExport(
  garageId: string,
  from: Date,
  toExclusive: Date,
) {
  return prisma.serviceOrderLine.findMany({
    where: {
      garageId,
      type: "OUTSIDE",
      gstRatePercent: { gt: 0 },
      createdAt: { gte: from, lt: toExclusive },
    },
    select: {
      id: true,
      description: true,
      quantity: true,
      unitPricePaise: true,
      gstSplit: true,
      gstRatePercent: true,
      createdAt: true,
      vendor: {
        select: { name: true, gstin: true },
      },
    },
    orderBy: { createdAt: "asc" },
    take: PURCHASE_GST_EXPORT_CAP,
  });
}

/** Expenses with GST > 0% in [from, toExclusive) by spentAt. */
export async function listExpensesForPurchaseGstExport(
  garageId: string,
  from: Date,
  toExclusive: Date,
) {
  return prisma.expense.findMany({
    where: {
      garageId,
      gstRatePercent: { gt: 0 },
      spentAt: { gte: from, lt: toExclusive },
    },
    select: {
      id: true,
      category: true,
      note: true,
      amountPaise: true,
      gstSplit: true,
      gstRatePercent: true,
      spentAt: true,
      vendor: {
        select: { name: true, gstin: true },
      },
    },
    orderBy: { spentAt: "asc" },
    take: PURCHASE_GST_EXPORT_CAP,
  });
}

/** Received PO part lines in [from, toExclusive) by receipt createdAt. */
export async function listPartsReceiptsForPurchaseGstExport(
  garageId: string,
  from: Date,
  toExclusive: Date,
) {
  return prisma.goodsReceiptLine.findMany({
    where: {
      garageId,
      goodsReceipt: {
        garageId,
        createdAt: { gte: from, lt: toExclusive },
      },
      purchaseOrderLine: {
        unitCostPaise: { gt: 0 },
      },
    },
    select: {
      id: true,
      quantity: true,
      goodsReceipt: {
        select: { createdAt: true },
      },
      purchaseOrderLine: {
        select: {
          unitCostPaise: true,
          purchaseOrder: {
            select: {
              vendor: {
                select: { name: true, gstin: true },
              },
            },
          },
        },
      },
      part: {
        select: {
          name: true,
          gstRatePercent: true,
        },
      },
    },
    orderBy: { goodsReceipt: { createdAt: "asc" } },
    take: PURCHASE_GST_EXPORT_CAP,
  });
}

export async function findGarageGstinForPurchaseExport(garageId: string) {
  const garage = await prisma.garage.findFirst({
    where: { id: garageId },
    select: { gstin: true },
  });
  return garage?.gstin ?? null;
}

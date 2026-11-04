import "server-only";

import { prisma } from "@/lib/db";
import { getStockLevelsForParts } from "@/modules/inventory/repo";
import type { ReportRange } from "@/modules/reports/period";
import type {
  GarageReportMeta,
  HsnReportRow,
  InvoiceTaxRow,
  PartsStockRow,
  StockMovementRow,
} from "@/modules/reports/detail-types";

const ROW_CAP = 2000;

export type {
  GarageReportMeta,
  HsnReportRow,
  InvoiceTaxRow,
  PartsStockRow,
  StockMovementRow,
};

export async function getGarageReportMeta(
  garageId: string,
): Promise<GarageReportMeta> {
  const garage = await prisma.garage.findFirst({
    where: { id: garageId },
    select: { name: true, gstin: true },
  });
  return {
    name: garage?.name ?? "",
    gstin: garage?.gstin ?? null,
  };
}

export async function loadPartsStockReport(
  garageId: string,
  range: ReportRange,
): Promise<PartsStockRow[]> {
  const parts = await prisma.part.findMany({
    where: { garageId },
    select: {
      id: true,
      name: true,
      sku: true,
      unit: true,
      purchasePricePaise: true,
      sellingPricePaise: true,
      lowStockLevel: true,
      hsn: true,
      gstRatePercent: true,
    },
    orderBy: { name: "asc" },
    take: ROW_CAP,
  });

  const partIds = parts.map((part) => part.id);
  const stocks = await getStockLevelsForParts(garageId, partIds);

  const qtyIn = new Map<string, number>();
  const qtyOut = new Map<string, number>();
  if (partIds.length > 0) {
    const grouped = await prisma.stockMovement.groupBy({
      by: ["partId", "type"],
      where: {
        garageId,
        partId: { in: partIds },
        createdAt: { gte: range.from, lte: range.to },
      },
      _sum: { quantityChange: true },
    });
    for (const row of grouped) {
      const sum = row._sum.quantityChange ?? 0;
      if (row.type === "IN") {
        qtyIn.set(row.partId, (qtyIn.get(row.partId) ?? 0) + sum);
      } else if (row.type === "OUT") {
        qtyOut.set(row.partId, (qtyOut.get(row.partId) ?? 0) + Math.abs(sum));
      }
    }
  }

  return parts.map((part) => ({
    id: part.id,
    name: part.name,
    sku: part.sku,
    unit: part.unit,
    purchasePricePaise: part.purchasePricePaise,
    sellingPricePaise: part.sellingPricePaise,
    quantityOnHand: stocks.get(part.id) ?? 0,
    qtyIn: qtyIn.get(part.id) ?? 0,
    qtyOut: qtyOut.get(part.id) ?? 0,
    lowStockLevel: part.lowStockLevel,
    hsn: part.hsn,
    gstRatePercent: part.gstRatePercent,
  }));
}

export async function loadStockMovementsReport(
  garageId: string,
  range: ReportRange,
): Promise<StockMovementRow[]> {
  const rows = await prisma.stockMovement.findMany({
    where: {
      garageId,
      createdAt: { gte: range.from, lte: range.to },
    },
    select: {
      id: true,
      type: true,
      quantityChange: true,
      note: true,
      createdAt: true,
      part: { select: { id: true, name: true, sku: true } },
      serviceOrder: { select: { jobCardNumber: true } },
      directSaleId: true,
    },
    orderBy: { createdAt: "desc" },
    take: ROW_CAP,
  });

  return rows.map((row) => {
    let reference = "";
    if (row.serviceOrder) {
      reference = `JC-${row.serviceOrder.jobCardNumber}`;
    } else if (row.directSaleId) {
      reference = "Direct sale";
    }
    return {
      id: row.id,
      date: row.createdAt.toISOString(),
      partId: row.part.id,
      partName: row.part.name,
      sku: row.part.sku,
      type: row.type,
      quantityChange: row.quantityChange,
      note: row.note,
      reference,
    };
  });
}

export async function loadInvoiceTaxReport(
  garageId: string,
  range: ReportRange,
): Promise<InvoiceTaxRow[]> {
  const invoices = await prisma.invoice.findMany({
    where: {
      garageId,
      status: "FINALIZED",
      finalizedAt: { gte: range.from, lte: range.to },
    },
    select: {
      id: true,
      invoiceNumber: true,
      finalizedAt: true,
      taxablePaise: true,
      cgstPaise: true,
      sgstPaise: true,
      igstPaise: true,
      totalPaise: true,
      gstSplit: true,
      customer: { select: { id: true, name: true } },
    },
    orderBy: { finalizedAt: "desc" },
    take: ROW_CAP,
  });

  return invoices.map((invoice) => ({
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber ?? invoice.id,
    date: (invoice.finalizedAt ?? range.to).toISOString(),
    customerId: invoice.customer.id,
    customerName: invoice.customer.name,
    taxablePaise: invoice.taxablePaise,
    cgstPaise: invoice.cgstPaise,
    sgstPaise: invoice.sgstPaise,
    igstPaise: invoice.igstPaise,
    totalPaise: invoice.totalPaise,
    gstSplit: invoice.gstSplit,
  }));
}

export async function loadHsnReport(
  garageId: string,
  range: ReportRange,
): Promise<HsnReportRow[]> {
  const lines = await prisma.invoiceLine.findMany({
    where: {
      garageId,
      invoice: {
        status: "FINALIZED",
        finalizedAt: { gte: range.from, lte: range.to },
      },
    },
    select: {
      hsnOrSac: true,
      taxablePaise: true,
      cgstPaise: true,
      sgstPaise: true,
      igstPaise: true,
      totalPaise: true,
    },
    take: ROW_CAP * 5,
  });

  const byCode = new Map<
    string,
    {
      taxablePaise: number;
      cgstPaise: number;
      sgstPaise: number;
      igstPaise: number;
      totalPaise: number;
      lineCount: number;
    }
  >();

  for (const line of lines) {
    const key = line.hsnOrSac.trim() || "—";
    const existing = byCode.get(key) ?? {
      taxablePaise: 0,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: 0,
      totalPaise: 0,
      lineCount: 0,
    };
    byCode.set(key, {
      taxablePaise: existing.taxablePaise + line.taxablePaise,
      cgstPaise: existing.cgstPaise + line.cgstPaise,
      sgstPaise: existing.sgstPaise + line.sgstPaise,
      igstPaise: existing.igstPaise + line.igstPaise,
      totalPaise: existing.totalPaise + line.totalPaise,
      lineCount: existing.lineCount + 1,
    });
  }

  return [...byCode.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([hsnOrSac, totals]) => ({
      id: hsnOrSac,
      hsnOrSac,
      ...totals,
    }));
}

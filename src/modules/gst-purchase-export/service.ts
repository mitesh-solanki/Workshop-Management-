import "server-only";

import {
  computeLineGstSplit,
  isSameStateSupply,
  type GstSplitKindValue,
} from "@/lib/gst";
import { gstinStateCode } from "@/lib/gstin";
import type { Paise } from "@/lib/money";
import { requireRole, type RoleSession } from "@/lib/rbac";
import {
  buildPurchaseGstExportCsv,
  purchaseGstExportFilename,
  purchaseGstRowId,
  type PurchaseGstExportRow,
} from "@/modules/gst-purchase-export/purchase-gst-export";
import {
  findGarageGstinForPurchaseExport,
  listExpensesForPurchaseGstExport,
  listOutsideWorkForPurchaseGstExport,
  listPartsReceiptsForPurchaseGstExport,
} from "@/modules/gst-purchase-export/repo";
import { purchaseGstExportListSchema } from "@/modules/gst-purchase-export/schema";
import { periodFromYearMonth } from "@/modules/payroll/date";

const READ_ROLES = ["OWNER", "MANAGER", "ACCOUNTANT"] as const;

function monthRangeUtc(yearMonth: string): { from: Date; toExclusive: Date } {
  const { periodStart } = periodFromYearMonth(yearMonth);
  const y = periodStart.getUTCFullYear();
  const m = periodStart.getUTCMonth();
  return {
    from: periodStart,
    toExclusive: new Date(Date.UTC(y, m + 1, 1)),
  };
}

function asGstSplit(value: string | null | undefined): GstSplitKindValue {
  return value === "IGST" ? "IGST" : "CGST_SGST";
}

function partsGstSameState(
  garageGstin: string | null,
  vendorGstin: string | null,
): boolean {
  const garageState = garageGstin ? gstinStateCode(garageGstin) : null;
  const vendorState = vendorGstin ? gstinStateCode(vendorGstin) : null;
  if (!garageState || !vendorState) return true;
  return isSameStateSupply(garageState, vendorState);
}

function toOutsideRow(line: {
  id: string;
  description: string;
  quantity: number;
  unitPricePaise: number;
  gstSplit: string | null;
  gstRatePercent: number | null;
  createdAt: Date;
  vendor: { name: string; gstin: string | null } | null;
}): PurchaseGstExportRow | null {
  const rate = line.gstRatePercent ?? 0;
  if (rate <= 0) return null;
  const amounts = computeLineGstSplit(
    {
      quantity: line.quantity,
      unitPricePaise: line.unitPricePaise as Paise,
      gstRatePercent: rate,
    },
    asGstSplit(line.gstSplit) === "CGST_SGST",
  );
  return {
    id: purchaseGstRowId("OUTSIDE_WORK", line.id),
    type: "OUTSIDE_WORK",
    spentAt: line.createdAt.toISOString(),
    vendorName: line.vendor?.name?.trim() || line.description.trim() || "—",
    vendorGstin: line.vendor?.gstin ?? null,
    taxablePaise: amounts.taxablePaise,
    cgstPaise: amounts.cgstPaise,
    sgstPaise: amounts.sgstPaise,
    igstPaise: amounts.igstPaise,
    totalPaise: amounts.totalPaise,
  };
}

function toExpenseRow(expense: {
  id: string;
  category: string;
  note: string | null;
  amountPaise: number;
  gstSplit: string;
  gstRatePercent: number;
  spentAt: Date;
  vendor: { name: string; gstin: string | null } | null;
}): PurchaseGstExportRow | null {
  if (expense.gstRatePercent <= 0) return null;
  const amounts = computeLineGstSplit(
    {
      quantity: 1,
      unitPricePaise: expense.amountPaise as Paise,
      gstRatePercent: expense.gstRatePercent,
    },
    asGstSplit(expense.gstSplit) === "CGST_SGST",
  );
  return {
    id: purchaseGstRowId("EXPENSE", expense.id),
    type: "EXPENSE",
    spentAt: expense.spentAt.toISOString(),
    vendorName: expense.vendor?.name?.trim() || "",
    vendorGstin: expense.vendor?.gstin ?? null,
    taxablePaise: amounts.taxablePaise,
    cgstPaise: amounts.cgstPaise,
    sgstPaise: amounts.sgstPaise,
    igstPaise: amounts.igstPaise,
    totalPaise: amounts.totalPaise,
  };
}

function toPartsRow(
  line: {
    id: string;
    quantity: number;
    goodsReceipt: { createdAt: Date };
    purchaseOrderLine: {
      unitCostPaise: number;
      purchaseOrder: {
        vendor: { name: string; gstin: string | null } | null;
      };
    };
    part: { name: string; gstRatePercent: number };
  },
  garageGstin: string | null,
): PurchaseGstExportRow | null {
  const unitCostPaise = line.purchaseOrderLine.unitCostPaise;
  if (unitCostPaise <= 0 || line.quantity <= 0) return null;

  const vendor = line.purchaseOrderLine.purchaseOrder.vendor;
  const rate = Math.max(0, line.part.gstRatePercent);
  const sameState = partsGstSameState(garageGstin, vendor?.gstin ?? null);
  const amounts = computeLineGstSplit(
    {
      quantity: line.quantity,
      unitPricePaise: unitCostPaise as Paise,
      gstRatePercent: rate,
    },
    sameState,
  );

  const vendorLabel = vendor?.name?.trim() || "";
  const partLabel = line.part.name.trim() || "—";
  const vendorName = vendorLabel
    ? `${vendorLabel} · ${partLabel}`
    : partLabel;

  return {
    id: purchaseGstRowId("PARTS", line.id),
    type: "PARTS",
    spentAt: line.goodsReceipt.createdAt.toISOString(),
    vendorName,
    vendorGstin: vendor?.gstin ?? null,
    taxablePaise: amounts.taxablePaise,
    cgstPaise: amounts.cgstPaise,
    sgstPaise: amounts.sgstPaise,
    igstPaise: amounts.igstPaise,
    totalPaise: amounts.totalPaise,
  };
}

function sortBySpentAt(a: PurchaseGstExportRow, b: PurchaseGstExportRow) {
  return a.spentAt.localeCompare(b.spentAt) || a.id.localeCompare(b.id);
}

export async function listPurchaseGstExportRows(
  session: RoleSession,
  raw: { yearMonth?: string },
) {
  requireRole(session, READ_ROLES);
  const input = purchaseGstExportListSchema.parse(raw);
  const { from, toExclusive } = monthRangeUtc(input.yearMonth);

  const [outsideLines, expenses, partsLines, garageGstin] = await Promise.all([
    listOutsideWorkForPurchaseGstExport(session.garageId, from, toExclusive),
    listExpensesForPurchaseGstExport(session.garageId, from, toExclusive),
    listPartsReceiptsForPurchaseGstExport(session.garageId, from, toExclusive),
    findGarageGstinForPurchaseExport(session.garageId),
  ]);

  const items = [
    ...partsLines
      .map((line) => toPartsRow(line, garageGstin))
      .filter((row): row is PurchaseGstExportRow => row != null),
    ...outsideLines
      .map(toOutsideRow)
      .filter((row): row is PurchaseGstExportRow => row != null),
    ...expenses
      .map(toExpenseRow)
      .filter((row): row is PurchaseGstExportRow => row != null),
  ].sort(sortBySpentAt);

  return {
    yearMonth: input.yearMonth,
    items,
  };
}

export function buildPurchaseGstExportFile(input: {
  yearMonth: string;
  rows: readonly PurchaseGstExportRow[];
  selectedIds: readonly string[];
}): { filename: string; csv: string; count: number } {
  const selected = new Set(input.selectedIds);
  const ordered = input.rows.filter((row) => selected.has(row.id));
  return {
    filename: purchaseGstExportFilename(input.yearMonth),
    csv: buildPurchaseGstExportCsv(ordered),
    count: ordered.length,
  };
}

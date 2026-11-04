import "server-only";

import { requireRole, type RoleSession } from "@/lib/rbac";
import {
  getGarageReportMeta,
  loadHsnReport,
  loadInvoiceTaxReport,
  loadPartsStockReport,
  loadStockMovementsReport,
} from "@/modules/reports/detail-repo";
import { toDetailReportCardView } from "@/modules/reports/detail-series";
import type {
  DetailReportCardView,
  DetailReportPayload,
  DetailReportsDashboard,
  GarageReportMeta,
} from "@/modules/reports/detail-types";
import { resolveReportPeriod } from "@/modules/reports/period";
import {
  loadCreditNotesReport,
  loadOutstandingReport,
  loadPaymentsReport,
  loadSalesReport,
  type ReportSeriesPoint,
  type ReportTableRow,
} from "@/modules/reports/repo";
import {
  detailReportQuerySchema,
  reportsDashboardQuerySchema,
  type DetailReportKey,
  type DetailReportQueryInput,
  type ReportCardKey,
  type ReportPeriod,
  type ReportsDashboardQueryInput,
} from "@/modules/reports/schema";

export type {
  DetailReportPayload,
  DetailReportCardView,
  DetailReportsDashboard,
};

const READ_ROLES = ["OWNER", "MANAGER", "ACCOUNTANT"] as const;

export type ReportCardData = {
  key: ReportCardKey;
  period: ReportPeriod;
  from: Date;
  to: Date;
  totalPaise: number;
  count: number;
  series: ReportSeriesPoint[];
  rows: ReportTableRow[];
};

export type ReportsDashboard = {
  sales: ReportCardData;
  payments: ReportCardData;
  outstanding: ReportCardData;
  creditNotes: ReportCardData;
};

async function loadCard(
  garageId: string,
  key: ReportCardKey,
  period: ReportPeriod,
): Promise<ReportCardData> {
  const range = resolveReportPeriod(period);
  const data =
    key === "sales"
      ? await loadSalesReport(garageId, range)
      : key === "payments"
        ? await loadPaymentsReport(garageId, range)
        : key === "creditNotes"
          ? await loadCreditNotesReport(garageId, range)
          : await loadOutstandingReport(garageId, range);

  return {
    key,
    period,
    from: range.from,
    to: range.to,
    ...data,
  };
}

async function loadDetailPayload(
  garageId: string,
  garage: GarageReportMeta,
  key: DetailReportKey,
  period: ReportPeriod,
): Promise<DetailReportPayload> {
  const range = resolveReportPeriod(period);
  const from = range.from.toISOString();
  const to = range.to.toISOString();

  if (key === "parts_stock") {
    return {
      key,
      period,
      from,
      to,
      garage,
      rows: await loadPartsStockReport(garageId, range),
    };
  }
  if (key === "stock_movements") {
    return {
      key,
      period,
      from,
      to,
      garage,
      rows: await loadStockMovementsReport(garageId, range),
    };
  }
  if (key === "invoice_tax") {
    return {
      key,
      period,
      from,
      to,
      garage,
      rows: await loadInvoiceTaxReport(garageId, range),
    };
  }
  return {
    key: "hsn",
    period,
    from,
    to,
    garage,
    rows: await loadHsnReport(garageId, range),
  };
}

export async function getReportsDashboard(
  session: RoleSession,
  raw: ReportsDashboardQueryInput = {},
): Promise<ReportsDashboard> {
  requireRole(session, READ_ROLES);
  const input = reportsDashboardQuerySchema.parse(raw);

  const [sales, payments, outstanding, creditNotes] = await Promise.all([
    loadCard(session.garageId, "sales", input.sales),
    loadCard(session.garageId, "payments", input.payments),
    loadCard(session.garageId, "outstanding", input.outstanding),
    loadCard(session.garageId, "creditNotes", input.creditNotes),
  ]);

  return { sales, payments, outstanding, creditNotes };
}

export async function getDetailReportsDashboard(
  session: RoleSession,
  raw: DetailReportQueryInput = {},
): Promise<DetailReportsDashboard> {
  requireRole(session, READ_ROLES);
  const input = detailReportQuerySchema.parse(raw);
  const garage = await getGarageReportMeta(session.garageId);

  const [parts_stock, stock_movements, invoice_tax, hsn] = await Promise.all([
    loadDetailPayload(
      session.garageId,
      garage,
      "parts_stock",
      input.parts_stock,
    ),
    loadDetailPayload(
      session.garageId,
      garage,
      "stock_movements",
      input.stock_movements,
    ),
    loadDetailPayload(
      session.garageId,
      garage,
      "invoice_tax",
      input.invoice_tax,
    ),
    loadDetailPayload(session.garageId, garage, "hsn", input.hsn),
  ]);

  return {
    parts_stock: toDetailReportCardView(parts_stock),
    stock_movements: toDetailReportCardView(stock_movements),
    invoice_tax: toDetailReportCardView(invoice_tax),
    hsn: toDetailReportCardView(hsn),
  };
}

export async function getMoneyReportCard(
  session: RoleSession,
  key: ReportCardKey,
  period: ReportPeriod,
): Promise<ReportCardData> {
  requireRole(session, READ_ROLES);
  return loadCard(session.garageId, key, period);
}

export async function getDetailReportCard(
  session: RoleSession,
  key: DetailReportKey,
  period: ReportPeriod,
): Promise<DetailReportCardView> {
  requireRole(session, READ_ROLES);
  const garage = await getGarageReportMeta(session.garageId);
  const payload = await loadDetailPayload(
    session.garageId,
    garage,
    key,
    period,
  );
  return toDetailReportCardView(payload);
}

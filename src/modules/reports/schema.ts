import { z } from "zod";

export const REPORT_CARD_KEYS = [
  "sales",
  "payments",
  "outstanding",
  "creditNotes",
] as const;

export type ReportCardKey = (typeof REPORT_CARD_KEYS)[number];

export const DETAIL_REPORT_KEYS = [
  "parts_stock",
  "stock_movements",
  "invoice_tax",
  "hsn",
] as const;

export type DetailReportKey = (typeof DETAIL_REPORT_KEYS)[number];

export const REPORT_PERIODS = [
  "last_30_days",
  "last_3_months",
  "last_6_months",
  "this_year",
  "last_year",
] as const;

export type ReportPeriod = (typeof REPORT_PERIODS)[number];

const periodSchema = z.enum(REPORT_PERIODS).default("last_3_months");

export const reportsDashboardQuerySchema = z.object({
  sales: periodSchema,
  payments: periodSchema,
  outstanding: periodSchema,
  creditNotes: periodSchema,
});

export type ReportsDashboardQueryInput = z.input<
  typeof reportsDashboardQuerySchema
>;

export const detailReportQuerySchema = z.object({
  parts_stock: periodSchema,
  stock_movements: periodSchema,
  invoice_tax: periodSchema,
  hsn: periodSchema,
});

export type DetailReportQueryInput = z.input<typeof detailReportQuerySchema>;

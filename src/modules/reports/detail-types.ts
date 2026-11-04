import type { DetailReportKey, ReportPeriod } from "@/modules/reports/schema";

export type GarageReportMeta = {
  name: string;
  gstin: string | null;
};

export type PartsStockRow = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  purchasePricePaise: number;
  sellingPricePaise: number;
  quantityOnHand: number;
  qtyIn: number;
  qtyOut: number;
  lowStockLevel: number;
  hsn: string;
  gstRatePercent: number;
};

export type StockMovementRow = {
  id: string;
  date: string;
  partId: string;
  partName: string;
  sku: string;
  type: "IN" | "OUT" | "ADJUSTMENT";
  quantityChange: number;
  note: string | null;
  reference: string;
};

export type InvoiceTaxRow = {
  id: string;
  invoiceNumber: string;
  date: string;
  customerId: string;
  customerName: string;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
  gstSplit: string;
};

export type HsnReportRow = {
  id: string;
  hsnOrSac: string;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
  lineCount: number;
};

export type DetailChartPoint = {
  key: string;
  label: string;
  amountPaise: number;
  href?: string;
};

export type DetailReportPayload =
  | {
      key: "parts_stock";
      period: ReportPeriod;
      from: string;
      to: string;
      rows: PartsStockRow[];
      garage: GarageReportMeta;
    }
  | {
      key: "stock_movements";
      period: ReportPeriod;
      from: string;
      to: string;
      rows: StockMovementRow[];
      garage: GarageReportMeta;
    }
  | {
      key: "invoice_tax";
      period: ReportPeriod;
      from: string;
      to: string;
      rows: InvoiceTaxRow[];
      garage: GarageReportMeta;
    }
  | {
      key: "hsn";
      period: ReportPeriod;
      from: string;
      to: string;
      rows: HsnReportRow[];
      garage: GarageReportMeta;
    };

export type DetailReportCardView = {
  key: DetailReportKey;
  period: ReportPeriod;
  from: string;
  to: string;
  count: number;
  heroKind: "money" | "number";
  heroValue: number;
  chartFormat: "money" | "number";
  series: DetailChartPoint[];
  garage: GarageReportMeta;
  payload: DetailReportPayload;
};

export type DetailReportsDashboard = {
  parts_stock: DetailReportCardView;
  stock_movements: DetailReportCardView;
  invoice_tax: DetailReportCardView;
  hsn: DetailReportCardView;
};

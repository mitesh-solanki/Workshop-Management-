import { describe, expect, it } from "vitest";
import { buildDetailReportCsv } from "@/modules/reports/detail-export";
import type { DetailReportPayload } from "@/modules/reports/detail-types";
import { buildMoneyReportCsv } from "@/modules/reports/money-export";
import type { MoneyReportCardState } from "@/modules/reports/money-card-state";
import {
  buildSleekBillCsv,
  formatReportDateDdMmYyyy,
  paiseToExportNumber,
} from "@/modules/reports/sleek-export";

describe("sleek export helpers", () => {
  it("formats dates as DD/MM/YYYY", () => {
    expect(formatReportDateDdMmYyyy(new Date(2026, 9, 4))).toBe("04/10/2026");
  });

  it("formats paise as rupee decimals", () => {
    expect(paiseToExportNumber(22000)).toBe("220.00");
    expect(paiseToExportNumber(33158)).toBe("331.58");
  });

  it("builds a Sleek Bill style header block with total", () => {
    const csv = buildSleekBillCsv({
      title: "Parts Stock",
      userLabel: "yflores",
      gstin: "24ABCDE1234F1Z5",
      rangeLine: "Stock from 01/04/2026 to 04/11/2026",
      headers: ["Item Name", "SKU", "QTY"],
      rows: [["Oil Filter", "OF-1", "3"]],
      footerRows: [["", "", "Total"], ["", "", "3"]],
    });

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("Parts Stock");
    expect(csv).toContain("yflores");
    expect(csv).toContain("GSTIN No.: 24ABCDE1234F1Z5");
    expect(csv).toContain("Stock from 01/04/2026 to 04/11/2026");
    expect(csv).toContain("Item Name,SKU,QTY");
    expect(csv).toContain("Oil Filter,OF-1,3");
    expect(csv).toContain("Total");
  });
});

describe("buildMoneyReportCsv", () => {
  it("exports outstanding with Sleek Bill header and total", () => {
    const card: MoneyReportCardState = {
      key: "outstanding",
      period: "this_year",
      from: new Date(2026, 3, 1).toISOString(),
      to: new Date(2026, 10, 4).toISOString(),
      totalPaise: 533832,
      count: 2,
      series: [],
      rows: [
        {
          id: "1",
          label: "INV-1",
          secondary: "Ramesh",
          date: new Date(2026, 9, 30).toISOString(),
          amountPaise: 212400,
        },
        {
          id: "2",
          label: "INV-2",
          secondary: "dsd",
          date: new Date(2026, 9, 29).toISOString(),
          amountPaise: 321432,
        },
      ],
    };

    const { filename, csv } = buildMoneyReportCsv(card, "seedowner", null, {
      title: "Outstanding",
      rangeLine: "From {from} to {to}",
      totalLabel: "Total",
      headers: {
        period: "Period",
        reference: "Reference",
        detail: "Detail",
        date: "Date",
        amount: "Amount (₹)",
      },
    });

    expect(filename).toMatch(
      /^\d{4}-\d{2}-\d{2}_Billing__OutstandingExport_seedowner\.csv$/,
    );
    expect(csv).toContain("Outstanding");
    expect(csv).toContain("GSTIN No.:");
    expect(csv).toContain("From 01/04/2026 to 04/11/2026");
    expect(csv).toContain("INV-1,Ramesh,30/10/2026,2124.00");
    expect(csv).toContain(",,,Total,5338.32");
  });
});

describe("buildDetailReportCsv", () => {
  it("names parts stock export like Sleek Bill", () => {
    const report: DetailReportPayload = {
      key: "parts_stock",
      period: "this_year",
      from: new Date(2026, 3, 1).toISOString(),
      to: new Date(2026, 10, 4).toISOString(),
      garage: { name: "Demo Garage", gstin: "24ABCDE1234F1Z5" },
      rows: [
        {
          id: "p1",
          name: "Brake Pad",
          sku: "BP-1",
          unit: "set",
          purchasePricePaise: 22000,
          sellingPricePaise: 12000,
          quantityOnHand: 1,
          qtyIn: 2,
          qtyOut: 1,
          lowStockLevel: 2,
          hsn: "8708",
          gstRatePercent: 18,
        },
      ],
    };

    const { filename, csv } = buildDetailReportCsv(report, "yflores", {
      title: "Parts Stock",
      rangePartsStock: "Stock from {from} to {to}",
      rangeMovements: "Movements from {from} to {to}",
      rangeInvoices: "Invoices from {from} to {to}",
      rangeHsn: "HSN from {from} to {to}",
      totalLabel: "Total",
      headers: {
        parts_stock: [
          "Item Name",
          "SKU",
          "UoM",
          "Purchase Rate",
          "Unit Price",
          "QTY",
          "Qty In",
          "Qty Out",
          "Low Stock",
          "HSN",
          "GST %",
        ],
        stock_movements: [],
        invoice_tax: [],
        hsn: [],
      },
      movementTypes: {
        IN: "IN",
        OUT: "OUT",
        ADJUSTMENT: "ADJUSTMENT",
      },
    });

    expect(filename).toMatch(
      /^\d{4}-\d{2}-\d{2}_Inventory__PartsStockExport_yflores\.csv$/,
    );
    expect(csv).toContain("Parts Stock");
    expect(csv).toContain("Brake Pad,BP-1,set,220.00,120.00,1,2,1,2,8708,18");
  });
});

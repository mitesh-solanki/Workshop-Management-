import { describe, expect, it } from "vitest";
import { toDetailReportCardView } from "@/modules/reports/detail-series";
import type { DetailReportPayload } from "@/modules/reports/detail-types";

describe("toDetailReportCardView", () => {
  it("sums invoice tax into taxable and GST component totals", () => {
    const payload: DetailReportPayload = {
      key: "invoice_tax",
      period: "this_year",
      from: new Date(2026, 3, 1).toISOString(),
      to: new Date(2026, 10, 4).toISOString(),
      garage: { name: "Demo", gstin: null },
      rows: [
        {
          id: "1",
          invoiceNumber: "INV-1",
          date: new Date(2026, 9, 1).toISOString(),
          customerId: "c1",
          customerName: "Ramesh",
          taxablePaise: 10000,
          cgstPaise: 900,
          sgstPaise: 900,
          igstPaise: 0,
          totalPaise: 11800,
          gstSplit: "CGST_SGST",
        },
        {
          id: "2",
          invoiceNumber: "INV-2",
          date: new Date(2026, 9, 2).toISOString(),
          customerId: "c2",
          customerName: "Suresh",
          taxablePaise: 20000,
          cgstPaise: 0,
          sgstPaise: 0,
          igstPaise: 3600,
          totalPaise: 23600,
          gstSplit: "IGST",
        },
      ],
    };

    const view = toDetailReportCardView(payload);
    expect(view.heroKind).toBe("money");
    expect(view.heroValue).toBe(35400);
    expect(view.count).toBe(2);
    expect(view.series).toEqual([
      { key: "taxable", label: "taxable", amountPaise: 30000 },
      { key: "cgst", label: "cgst", amountPaise: 900 },
      { key: "sgst", label: "sgst", amountPaise: 900 },
      { key: "igst", label: "igst", amountPaise: 3600 },
    ]);
  });
});

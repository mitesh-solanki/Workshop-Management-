import { describe, expect, it } from "vitest";
import { toDetailReportCardView } from "@/modules/reports/detail-series";
import type { DetailReportPayload } from "@/modules/reports/detail-types";

describe("toDetailReportCardView", () => {
  it("builds money chart series for invoice tax by customer", () => {
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
          customerId: "c1",
          customerName: "Ramesh",
          taxablePaise: 20000,
          cgstPaise: 1800,
          sgstPaise: 1800,
          igstPaise: 0,
          totalPaise: 23600,
          gstSplit: "CGST_SGST",
        },
      ],
    };

    const view = toDetailReportCardView(payload);
    expect(view.heroKind).toBe("money");
    expect(view.heroValue).toBe(35400);
    expect(view.series).toEqual([
      {
        key: "c1",
        label: "Ramesh",
        amountPaise: 35400,
        href: "/customers/c1",
      },
    ]);
  });
});

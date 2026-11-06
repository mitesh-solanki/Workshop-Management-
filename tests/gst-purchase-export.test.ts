import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError } from "@/lib/errors";
import {
  buildPurchaseGstExportCsv,
  filterSelectedPurchaseGstExportRows,
  PURCHASE_GST_EXPORT_HEADERS,
  purchaseGstAmounts,
  purchaseGstExportFilename,
  purchaseGstExportSheetRows,
  purchaseGstRowId,
  type PurchaseGstExportRow,
} from "@/modules/gst-purchase-export/purchase-gst-export";
import {
  findGarageGstinForPurchaseExport,
  listExpensesForPurchaseGstExport,
  listOutsideWorkForPurchaseGstExport,
  listPartsReceiptsForPurchaseGstExport,
} from "@/modules/gst-purchase-export/repo";
import { listPurchaseGstExportRows } from "@/modules/gst-purchase-export/service";

vi.mock("@/modules/gst-purchase-export/repo", () => ({
  listOutsideWorkForPurchaseGstExport: vi.fn(),
  listExpensesForPurchaseGstExport: vi.fn(),
  listPartsReceiptsForPurchaseGstExport: vi.fn(),
  findGarageGstinForPurchaseExport: vi.fn(),
}));

const garageA = "garage-a";
const garageB = "garage-b";
const ownerA = {
  userId: "user-a",
  garageId: garageA,
  role: "OWNER" as const,
  email: "a@example.com",
  name: "Owner A",
};
const techA = {
  userId: "tech-a",
  garageId: garageA,
  role: "TECHNICIAN" as const,
  email: "t@example.com",
  name: "Tech A",
};

const sampleRow: PurchaseGstExportRow = {
  id: purchaseGstRowId("OUTSIDE_WORK", "line-1"),
  type: "OUTSIDE_WORK",
  spentAt: "2026-11-05T10:00:00.000Z",
  vendorName: "Paint Shop",
  vendorGstin: "24ABCDE1234F1Z5",
  taxablePaise: 100000,
  cgstPaise: 9000,
  sgstPaise: 9000,
  igstPaise: 0,
  totalPaise: 118000,
};

describe("purchase gst export builders", () => {
  it("splits CGST/SGST from taxable amount and rate", () => {
    const amounts = purchaseGstAmounts({
      taxablePaise: 100000,
      gstRatePercent: 18,
      gstSplit: "CGST_SGST",
    });
    expect(amounts.taxablePaise).toBe(100000);
    expect(amounts.cgstPaise).toBe(9000);
    expect(amounts.sgstPaise).toBe(9000);
    expect(amounts.igstPaise).toBe(0);
    expect(amounts.totalPaise).toBe(118000);
  });

  it("builds sheet rows with type and vendor columns", () => {
    const rows = purchaseGstExportSheetRows([sampleRow]);
    expect(PURCHASE_GST_EXPORT_HEADERS).toHaveLength(9);
    expect(rows[0]).toEqual([
      "05/11/2026",
      "Outside Work",
      "Paint Shop",
      "24ABCDE1234F1Z5",
      "1000.00",
      "90.00",
      "90.00",
      "0.00",
      "1180.00",
    ]);
  });

  it("filters by selected ids and builds a csv file", () => {
    const second: PurchaseGstExportRow = {
      ...sampleRow,
      id: purchaseGstRowId("EXPENSE", "exp-1"),
      type: "EXPENSE",
      vendorName: "Electricity",
      vendorGstin: null,
    };
    const selected = filterSelectedPurchaseGstExportRows(
      [sampleRow, second],
      [second.id],
    );
    expect(selected).toHaveLength(1);
    expect(selected[0]?.type).toBe("EXPENSE");

    const csv = buildPurchaseGstExportCsv(selected);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain(
      "Date,Type,Vendor,GSTIN,Price,CGST,SGST,IGST,Total",
    );
    expect(csv).toContain("Expense");
    expect(csv).toContain("Electricity");
    expect(
      purchaseGstExportFilename("2026-11", new Date("2026-11-06T00:00:00Z")),
    ).toBe("November-2026_GST_Purchases_2026-11-06.csv");
  });
});

describe("purchase gst export service garage isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks technicians", async () => {
    await expect(
      listPurchaseGstExportRows(techA, { yearMonth: "2026-11" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("queries only the session garage", async () => {
    vi.mocked(listOutsideWorkForPurchaseGstExport).mockResolvedValue([]);
    vi.mocked(listExpensesForPurchaseGstExport).mockResolvedValue([]);
    vi.mocked(listPartsReceiptsForPurchaseGstExport).mockResolvedValue([]);
    vi.mocked(findGarageGstinForPurchaseExport).mockResolvedValue(null);

    await listPurchaseGstExportRows(ownerA, { yearMonth: "2026-11" });

    expect(listOutsideWorkForPurchaseGstExport).toHaveBeenCalledWith(
      garageA,
      expect.any(Date),
      expect.any(Date),
    );
    expect(listExpensesForPurchaseGstExport).toHaveBeenCalledWith(
      garageA,
      expect.any(Date),
      expect.any(Date),
    );
    expect(listPartsReceiptsForPurchaseGstExport).toHaveBeenCalledWith(
      garageA,
      expect.any(Date),
      expect.any(Date),
    );
    expect(listOutsideWorkForPurchaseGstExport).not.toHaveBeenCalledWith(
      garageB,
      expect.anything(),
      expect.anything(),
    );
  });

  it("maps parts receipts, outside work and expenses", async () => {
    vi.mocked(findGarageGstinForPurchaseExport).mockResolvedValue(
      "24AAAAA0000A1Z5",
    );
    vi.mocked(listPartsReceiptsForPurchaseGstExport).mockResolvedValue([
      {
        id: "grl-1",
        quantity: 2,
        goodsReceipt: { createdAt: new Date("2026-11-02T08:00:00.000Z") },
        purchaseOrderLine: {
          unitCostPaise: 50000,
          purchaseOrder: {
            vendor: { name: "Auto Parts Co", gstin: "24ABCDE1234F1Z5" },
          },
        },
        part: { name: "Oil Filter", gstRatePercent: 18 },
      },
    ] as never);
    vi.mocked(listOutsideWorkForPurchaseGstExport).mockResolvedValue([
      {
        id: "line-1",
        description: "Denting",
        quantity: 1,
        unitPricePaise: 100000,
        gstSplit: "CGST_SGST",
        gstRatePercent: 18,
        createdAt: new Date("2026-11-03T08:00:00.000Z"),
        vendor: { name: "Paint Shop", gstin: "24ABCDE1234F1Z5" },
      },
    ] as never);
    vi.mocked(listExpensesForPurchaseGstExport).mockResolvedValue([
      {
        id: "exp-1",
        category: "Electricity",
        note: null,
        amountPaise: 50000,
        gstSplit: "IGST",
        gstRatePercent: 18,
        spentAt: new Date("2026-11-04T00:00:00.000Z"),
        vendor: null,
      },
    ] as never);

    const result = await listPurchaseGstExportRows(ownerA, {
      yearMonth: "2026-11",
    });

    expect(result.items).toHaveLength(3);
    expect(result.items[0]?.type).toBe("PARTS");
    expect(result.items[0]?.vendorName).toBe("Auto Parts Co · Oil Filter");
    expect(result.items[0]?.vendorGstin).toBe("24ABCDE1234F1Z5");
    expect(result.items[0]?.taxablePaise).toBe(100000);
    expect(result.items[0]?.totalPaise).toBe(118000);
    expect(result.items[1]?.type).toBe("OUTSIDE_WORK");
    expect(result.items[1]?.totalPaise).toBe(118000);
    expect(result.items[2]?.type).toBe("EXPENSE");
    expect(result.items[2]?.vendorName).toBe("");
    expect(result.items[2]?.vendorGstin).toBeNull();
    expect(result.items[2]?.igstPaise).toBe(9000);
  });
});

describe("purchase gst export empty vendor cells", () => {
  it("writes dash for missing vendor and gstin", () => {
    const row: PurchaseGstExportRow = {
      id: purchaseGstRowId("EXPENSE", "exp-2"),
      type: "EXPENSE",
      spentAt: "2026-11-05T00:00:00.000Z",
      vendorName: "",
      vendorGstin: null,
      taxablePaise: 10000,
      cgstPaise: 900,
      sgstPaise: 900,
      igstPaise: 0,
      totalPaise: 11800,
    };
    expect(purchaseGstExportSheetRows([row])[0]?.slice(2, 4)).toEqual([
      "—",
      "—",
    ]);
  });
});

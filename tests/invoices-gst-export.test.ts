import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError } from "@/lib/errors";
import {
  buildGstExportCsv,
  filterSelectedGstExportRows,
  GST_EXPORT_HEADERS,
  gstExportFilename,
  gstExportSheetRows,
  type GstExportInvoiceRow,
} from "@/modules/invoices/gst-export";
import {
  listFinalizedInvoicesForGstExport,
  listFinalizedInvoicesForGstExportByIds,
} from "@/modules/invoices/repo";
import {
  buildGstExportFile,
  listGstExportInvoices,
} from "@/modules/invoices/service";

vi.mock("@/modules/invoices/repo", () => ({
  searchInvoices: vi.fn(),
  listFinalizedInvoicesForGstExport: vi.fn(),
  listFinalizedInvoicesForGstExportByIds: vi.fn(),
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

const sampleRow: GstExportInvoiceRow = {
  id: "inv-1",
  invoiceNumber: "INV-2026-27-1",
  finalizedAt: "2026-11-05T10:00:00.000Z",
  customerName: "Ramesh",
  customerGstin: "24ABCDE1234F1Z5",
  taxablePaise: 100000,
  cgstPaise: 9000,
  sgstPaise: 9000,
  igstPaise: 0,
  totalPaise: 118000,
};

describe("gst export builders", () => {
  it("builds sheet rows with GST columns and rupee numbers", () => {
    const rows = gstExportSheetRows([sampleRow]);
    expect(GST_EXPORT_HEADERS).toHaveLength(8);
    expect(rows[0]).toEqual([
      "05/11/2026",
      "Ramesh",
      "24ABCDE1234F1Z5",
      "1000.00",
      "90.00",
      "90.00",
      "0.00",
      "1180.00",
    ]);
  });

  it("filters by selected ids and builds a csv file", () => {
    const second = { ...sampleRow, id: "inv-2", customerName: "Suresh" };
    const selected = filterSelectedGstExportRows([sampleRow, second], ["inv-2"]);
    expect(selected).toHaveLength(1);
    expect(selected[0]?.id).toBe("inv-2");

    const csv = buildGstExportCsv(selected);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain(
      "Date,Customer,GSTIN,Price,CGST,SGST,IGST,Total",
    );
    expect(csv).not.toContain("Invoice No");
    expect(csv).toContain("Suresh");
    expect(gstExportFilename("2026-11", new Date("2026-11-06T00:00:00Z"))).toBe(
      "November-2026_GST_Invoices_2026-11-06.csv",
    );
  });
});

describe("gst export service garage isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks technicians", async () => {
    await expect(
      listGstExportInvoices(techA, { yearMonth: "2026-11" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("lists using session garageId only", async () => {
    vi.mocked(listFinalizedInvoicesForGstExport).mockResolvedValue([]);

    await listGstExportInvoices(ownerA, { yearMonth: "2026-11" });

    expect(listFinalizedInvoicesForGstExport).toHaveBeenCalledTimes(1);
    const [garageId, from, toExclusive] = vi.mocked(
      listFinalizedInvoicesForGstExport,
    ).mock.calls[0]!;
    expect(garageId).toBe(garageA);
    expect(garageId).not.toBe(garageB);
    expect(from.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(toExclusive.toISOString()).toBe("2026-12-01T00:00:00.000Z");
  });

  it("exports only selected ids from session garage", async () => {
    vi.mocked(listFinalizedInvoicesForGstExportByIds).mockResolvedValue([
      {
        id: "inv-1",
        invoiceNumber: "INV-2026-27-0001",
        finalizedAt: new Date("2026-11-05T10:00:00.000Z"),
        taxablePaise: 100000,
        cgstPaise: 9000,
        sgstPaise: 9000,
        igstPaise: 0,
        totalPaise: 118000,
        customer: { name: "Ramesh", gstin: "24ABCDE1234F1Z5" },
        serviceOrder: { jobCardNumber: 12 },
      },
    ]);

    const result = await buildGstExportFile(ownerA, {
      yearMonth: "2026-11",
      invoiceIds: ["inv-1", "missing"],
    });

    expect(listFinalizedInvoicesForGstExportByIds).toHaveBeenCalledWith(
      garageA,
      expect.any(Date),
      expect.any(Date),
      ["inv-1", "missing"],
    );
    expect(result.count).toBe(1);
    expect(result.filename).toMatch(
      /^November-2026_GST_Invoices_\d{4}-\d{2}-\d{2}\.csv$/,
    );
    expect(result.csv).toContain("Ramesh");
  });
});

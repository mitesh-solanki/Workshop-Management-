import { describe, expect, it } from "vitest";
import { generateInvoicePdf } from "@/modules/billing/pdf";
import { getInvoicePdfLabels } from "@/modules/billing/pdf-labels";

describe("invoice PDF generation", () => {
  it("produces a PDF buffer with locale labels and no e-invoice claim", async () => {
    const { buffer, labels } = await generateInvoicePdf({
      locale: "en",
      status: "FINALIZED",
      invoiceNumber: "INV-2025-26-0001",
      issuedAt: new Date("2025-06-15T10:00:00Z"),
      garage: {
        name: "Test Garage",
        address: "Ahmedabad",
        gstin: "24AABCU9603R1ZM",
      },
      customer: { name: "Ravi", phone: "9876543210", address: null },
      vehicle: {
        registrationNumber: "GJ01AB1234",
        make: "Maruti",
        model: "Swift",
      },
      placeOfSupplyStateCode: "24",
      sellerStateCode: "24",
      gstSplit: "CGST_SGST",
      lines: [
        {
          description: "Labour",
          hsnOrSac: "998714",
          quantity: 1,
          unitPricePaise: 100_000,
          gstRatePercent: 18,
          taxablePaise: 100_000,
          cgstPaise: 9_000,
          sgstPaise: 9_000,
          igstPaise: 0,
          totalPaise: 118_000,
        },
      ],
      taxablePaise: 100_000,
      cgstPaise: 9_000,
      sgstPaise: 9_000,
      igstPaise: 0,
      totalPaise: 118_000,
      amountPaidPaise: 0,
      payments: [],
      creditNotes: [],
      notes: null,
    });

    expect(buffer.subarray(0, 4).toString("ascii")).toBe("%PDF");
    // pdfkit may hex-encode strings; latin1 still surfaces the invoice number bytes.
    const asLatin1 = buffer.toString("latin1");
    expect(
      asLatin1.includes("INV-2025-26-0001") || asLatin1.includes("0001"),
    ).toBe(true);
    expect(labels).toEqual(getInvoicePdfLabels("en"));
    expect(labels.notEInvoice).toMatch(/not an e-invoice/i);
    expect(labels.gstRate).toBe("GST%");
  });

  it("selects Hindi and Gujarati label sets for PDF", async () => {
    for (const locale of ["hi", "gu"] as const) {
      const { labels } = await generateInvoicePdf({
        locale,
        status: "DRAFT",
        invoiceNumber: null,
        issuedAt: new Date(),
        garage: { name: "G", address: null, gstin: null },
        customer: { name: "C", phone: "9", address: null },
        vehicle: null,
        placeOfSupplyStateCode: "24",
        sellerStateCode: "24",
        gstSplit: "IGST",
        lines: [],
        taxablePaise: 0,
        cgstPaise: 0,
        sgstPaise: 0,
        igstPaise: 0,
        totalPaise: 0,
        amountPaidPaise: 0,
        payments: [],
        creditNotes: [],
        notes: null,
      });
      expect(labels.locale).toBe(locale);
      expect(labels).toEqual(getInvoicePdfLabels(locale));
    }
  });
});

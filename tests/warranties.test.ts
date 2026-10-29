import { describe, expect, it } from "vitest";
import { partRequiresWarrantyCard } from "@/modules/warranties/part-requires-warranty";
import {
  saveInvoiceLineWarrantySchema,
  createManualWarrantySchema,
} from "@/modules/warranties/schema";

describe("partRequiresWarrantyCard", () => {
  it("requires warranty when the part name contains battery", () => {
    expect(partRequiresWarrantyCard("Battery 35Ah")).toBe(true);
    expect(partRequiresWarrantyCard("Car battery")).toBe(true);
    expect(partRequiresWarrantyCard("BATTERY")).toBe(true);
    expect(partRequiresWarrantyCard("  spare battery pack ")).toBe(true);
  });

  it("does not require warranty for other parts", () => {
    expect(partRequiresWarrantyCard("Engine oil 5W-30")).toBe(false);
    expect(partRequiresWarrantyCard("Brake pad set")).toBe(false);
    expect(partRequiresWarrantyCard("testing spare part addition")).toBe(
      false,
    );
    expect(partRequiresWarrantyCard("")).toBe(false);
  });
});

describe("saveInvoiceLineWarrantySchema", () => {
  it("accepts partial autosave with expiry only", () => {
    const parsed = saveInvoiceLineWarrantySchema.parse({
      invoiceId: "inv-1",
      invoiceLineId: "line-1",
      warrantyExpiresAt: "2026-10-21",
      storageKey: null,
    });
    expect(parsed.storageKey).toBeNull();
    expect(parsed.warrantyExpiresAt).toEqual(
      new Date("2026-10-21T12:00:00.000Z"),
    );
  });

  it("accepts clearing the photo while keeping expiry", () => {
    const parsed = saveInvoiceLineWarrantySchema.parse({
      invoiceId: "inv-1",
      invoiceLineId: "line-1",
      warrantyExpiresAt: "2026-12-01",
      storageKey: null,
      contentType: null,
      byteSize: null,
      fileName: null,
    });
    expect(parsed.storageKey).toBeNull();
    expect(parsed.contentType).toBeNull();
    expect(parsed.fileName).toBeNull();
  });

  it("accepts a photo key for garage vehicle warranty path shape", () => {
    const parsed = saveInvoiceLineWarrantySchema.parse({
      invoiceId: "inv-1",
      invoiceLineId: "line-1",
      storageKey:
        "garages/g1/vehicles/v1/warranty/card-abc.jpg",
      contentType: "image/jpeg",
      byteSize: 12_000,
      fileName: "card.jpg",
    });
    expect(parsed.storageKey).toContain("/warranty/");
    expect(parsed.byteSize).toBe(12_000);
  });

  it("rejects empty invoice ids", () => {
    const result = saveInvoiceLineWarrantySchema.safeParse({
      invoiceId: "  ",
      invoiceLineId: "line-1",
    });
    expect(result.success).toBe(false);
  });
});

describe("createManualWarrantySchema", () => {
  it("requires a part name", () => {
    const result = createManualWarrantySchema.safeParse({
      vehicleId: "veh-1",
      partName: "",
    });
    expect(result.success).toBe(false);
  });

  it("allows optional photo and expiry for non-battery create input shape", () => {
    const parsed = createManualWarrantySchema.parse({
      vehicleId: "veh-1",
      partName: "Brake pad",
      warrantyExpiresAt: "2027-01-15",
      storageKey: null,
    });
    expect(parsed.partName).toBe("Brake pad");
    expect(parsed.storageKey).toBeNull();
  });
});

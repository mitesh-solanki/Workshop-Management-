import { describe, expect, it } from "vitest";
import {
  createVendorSchema,
  deleteVendorSchema,
} from "@/modules/vendors/schema";
import {
  cancelPartsRequestSchema,
  removeVendorBillAttachmentSchema,
} from "@/modules/purchases/schema";

describe("createVendorSchema", () => {
  it("requires name and phone or email", () => {
    const missingContact = createVendorSchema.safeParse({
      name: "Acme Spares",
      phone: "",
      email: "",
    });
    expect(missingContact.success).toBe(false);

    const withPhone = createVendorSchema.safeParse({
      name: "Acme Spares",
      phone: "9876543210",
      email: "",
    });
    expect(withPhone.success).toBe(true);

    const withEmail = createVendorSchema.safeParse({
      name: "Acme Spares",
      phone: "",
      email: "sales@acme.example",
    });
    expect(withEmail.success).toBe(true);
  });

  it("rejects invalid email, phone and GSTIN", () => {
    expect(
      createVendorSchema.safeParse({
        name: "Acme",
        phone: "12",
        email: "",
      }).success,
    ).toBe(false);

    expect(
      createVendorSchema.safeParse({
        name: "Acme",
        phone: "",
        email: "not-an-email",
      }).success,
    ).toBe(false);

    expect(
      createVendorSchema.safeParse({
        name: "Acme",
        phone: "9876543210",
        gstin: "INVALID",
      }).success,
    ).toBe(false);
  });

  it("accepts a valid GSTIN and normalises it", () => {
    const parsed = createVendorSchema.safeParse({
      name: "Acme",
      phone: "9876543210",
      gstin: "24aaaaa0000a1z5",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.gstin).toBe("24AAAAA0000A1Z5");
    }
  });
});

describe("ID-only mutation schemas", () => {
  it("rejects blank ids for cancel, delete vendor and remove attachment", () => {
    expect(cancelPartsRequestSchema.safeParse({ requestId: "" }).success).toBe(
      false,
    );
    expect(cancelPartsRequestSchema.safeParse({ requestId: "  " }).success).toBe(
      false,
    );
    expect(deleteVendorSchema.safeParse({ vendorId: "" }).success).toBe(false);
    expect(
      removeVendorBillAttachmentSchema.safeParse({ vendorBillId: "" }).success,
    ).toBe(false);
  });

  it("accepts non-empty ids for cancel, delete vendor and remove attachment", () => {
    expect(
      cancelPartsRequestSchema.safeParse({ requestId: "req_1" }).success,
    ).toBe(true);
    expect(deleteVendorSchema.safeParse({ vendorId: "vnd_1" }).success).toBe(
      true,
    );
    expect(
      removeVendorBillAttachmentSchema.safeParse({ vendorBillId: "bill_1" })
        .success,
    ).toBe(true);
  });
});

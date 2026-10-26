import { describe, expect, it } from "vitest";
import { assertRequiredFieldsMapped } from "@/modules/data-import/schema";
import {
  buildErrorReportRows,
  normalisePhoneKey,
  validateImportRows,
} from "@/modules/data-import/validate";

describe("data-import validation", () => {
  it("requires mapped customer fields", () => {
    expect(
      assertRequiredFieldsMapped("customers", {
        name: 0,
        phone: null,
      }),
    ).toEqual(["phone"]);
  });

  it("validates customer rows and flags duplicates in file", () => {
    const result = validateImportRows(
      "customers",
      [
        ["Ravi", "9876543210", "", ""],
        ["Other", "9876543210", "", ""],
        ["", "9123456780", "", ""],
      ],
      { name: 0, phone: 1, address: 2, notes: 3 },
    );

    expect(result.entity).toBe("customers");
    if (result.entity !== "customers") {
      throw new Error("expected customers");
    }
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0]?.phone).toBe("9876543210");
    expect(result.valid[0]?.existingCustomerId).toBeNull();
    expect(
      result.errors.some((e) => e.code === "import.duplicate_phone_in_file"),
    ).toBe(true);
    expect(result.errors.some((e) => e.rowNumber === 4)).toBe(true);
  });

  it("flags customer phone that already exists in the garage", () => {
    const result = validateImportRows(
      "customers",
      [["Ravi", "9876543210", "", ""]],
      { name: 0, phone: 1, address: 2, notes: 3 },
      {
        customerIdByPhone: new Map([
          [normalisePhoneKey("9876543210"), "cust-existing"],
        ]),
      },
    );

    expect(result.valid).toHaveLength(0);
    expect(
      result.errors.some((e) => e.code === "import.customer_exists"),
    ).toBe(true);
  });

  it("marks existing customer rows as updates when policy is update", () => {
    const result = validateImportRows(
      "customers",
      [
        ["Ravi Updated", "9876543210", "New addr", ""],
        ["New Person", "9000011111", "", ""],
      ],
      { name: 0, phone: 1, address: 2, notes: 3 },
      {
        customerIdByPhone: new Map([
          [normalisePhoneKey("9876543210"), "cust-existing"],
        ]),
        existingCustomerPolicy: "update",
      },
    );

    expect(result.entity).toBe("customers");
    if (result.entity !== "customers") {
      throw new Error("expected customers");
    }
    expect(result.valid).toHaveLength(2);
    expect(result.valid[0]?.existingCustomerId).toBe("cust-existing");
    expect(result.valid[0]?.name).toBe("Ravi Updated");
    expect(result.valid[1]?.existingCustomerId).toBeNull();
    expect(result.errors).toHaveLength(0);
  });

  const vehicleMapping = {
    customerName: 0,
    customerPhone: 1,
    customerAddress: 2,
    registrationNumber: 3,
    make: 4,
    model: 5,
    year: 6,
    odometer: 7,
    insuranceExpiry: 8,
    pucExpiry: 9,
    fitnessExpiry: 10,
  };

  it("links vehicles to existing phone and creates customer when phone is new", () => {
    const phoneMap = new Map([
      [normalisePhoneKey("9876543210"), "cust-1"],
    ]);
    const result = validateImportRows(
      "vehicles",
      [
        ["", "9876543210", "", "GJ01AB1234", "Maruti", "Swift", "2019", "", "", "", ""],
        ["New Owner", "9999999999", "", "GJ01ZZ9999", "Honda", "City", "", "", "", "", ""],
        ["", "9876543210", "", "GJ01AB1234", "Maruti", "Baleno", "", "", "", "", ""],
      ],
      vehicleMapping,
      {
        customerIdByPhone: phoneMap,
        existingRegistrations: new Set(["GJ01EXISTING"]),
      },
    );

    expect(result.entity).toBe("vehicles");
    if (result.entity !== "vehicles") {
      throw new Error("expected vehicles");
    }
    expect(result.valid).toHaveLength(2);
    expect(result.valid[0]?.customerId).toBe("cust-1");
    expect(result.valid[0]?.customerCreate).toBeNull();
    expect(result.valid[1]?.customerId).toBeNull();
    expect(result.valid[1]?.customerCreate?.name).toBe("New Owner");
    expect(result.valid[1]?.registrationNumber).toBe("GJ01ZZ9999");
    expect(
      result.errors.some(
        (e) => e.code === "import.duplicate_registration_in_file",
      ),
    ).toBe(true);
  });

  it("requires customer name when phone is new", () => {
    const result = validateImportRows(
      "vehicles",
      [["", "9000011111", "", "GJ09NE1111", "Tata", "Nexon", "", "", "", "", ""]],
      vehicleMapping,
      { customerIdByPhone: new Map(), existingRegistrations: new Set() },
    );
    expect(result.valid).toHaveLength(0);
    expect(
      result.errors.some((e) => e.code === "import.customer_name_required"),
    ).toBe(true);
  });

  it("requires customer phone on vehicle rows", () => {
    const result = validateImportRows(
      "vehicles",
      [["Owner", "", "", "GJ09NE2222", "Tata", "Nexon", "", "", "", "", ""]],
      vehicleMapping,
      { customerIdByPhone: new Map(), existingRegistrations: new Set() },
    );
    expect(result.valid).toHaveLength(0);
    expect(
      result.errors.some((e) => e.code === "import.customer_phone_required"),
    ).toBe(true);
  });

  it("rejects vehicle when registration already exists in garage", () => {
    const result = validateImportRows(
      "vehicles",
      [["", "9876543210", "", "gj 01 ab 1234", "Maruti", "Swift", "", "", "", "", ""]],
      vehicleMapping,
      {
        customerIdByPhone: new Map([["9876543210", "cust-1"]]),
        existingRegistrations: new Set(["GJ01AB1234"]),
      },
    );

    expect(result.valid).toHaveLength(0);
    expect(
      result.errors.some((e) => e.code === "import.registration_exists"),
    ).toBe(true);
  });

  it("validates parts with rupee prices and duplicate SKUs", () => {
    const result = validateImportRows(
      "parts",
      [
        ["Oil", "oil-1", "litre", "100.50", "150", "18", "271019", "5", "10"],
        ["Oil 2", "OIL-1", "litre", "100", "150", "18", "271019", "5", ""],
        ["Pad", "PAD-1", "set", "bad", "200", "28", "870830", "2", "0"],
      ],
      {
        name: 0,
        sku: 1,
        unit: 2,
        purchasePrice: 3,
        sellingPrice: 4,
        gstRatePercent: 5,
        hsn: 6,
        lowStockLevel: 7,
        openingStock: 8,
      },
      { partIdBySku: new Map([["PAD-EXISTING", "part-pad"]]) },
    );

    expect(result.entity).toBe("parts");
    if (result.entity !== "parts") {
      throw new Error("expected parts");
    }
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0]?.sku).toBe("OIL-1");
    expect(result.valid[0]?.purchasePricePaise).toBe(10050);
    expect(result.valid[0]?.openingStock).toBe(10);
    expect(result.valid[0]?.existingPartId).toBeNull();
    expect(
      result.errors.some((e) => e.code === "import.duplicate_sku_in_file"),
    ).toBe(true);
  });

  it("marks existing part SKUs for update when policy is update", () => {
    const result = validateImportRows(
      "parts",
      [["Oil", "oil-1", "litre", "100", "150", "18", "271019", "5", "10"]],
      {
        name: 0,
        sku: 1,
        unit: 2,
        purchasePrice: 3,
        sellingPrice: 4,
        gstRatePercent: 5,
        hsn: 6,
        lowStockLevel: 7,
        openingStock: 8,
      },
      {
        partIdBySku: new Map([["OIL-1", "part-1"]]),
        existingPartPolicy: "update",
      },
    );

    expect(result.entity).toBe("parts");
    if (result.entity !== "parts") {
      throw new Error("expected parts");
    }
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0]?.existingPartId).toBe("part-1");
    expect(result.valid[0]?.openingStock).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it("errors on existing part SKU when policy is error", () => {
    const result = validateImportRows(
      "parts",
      [["Oil", "oil-1", "litre", "100", "150", "18", "271019", "5", ""]],
      {
        name: 0,
        sku: 1,
        unit: 2,
        purchasePrice: 3,
        sellingPrice: 4,
        gstRatePercent: 5,
        hsn: 6,
        lowStockLevel: 7,
        openingStock: 8,
      },
      { partIdBySku: new Map([["OIL-1", "part-1"]]) },
    );

    expect(result.valid).toHaveLength(0);
    expect(result.errors.some((e) => e.code === "import.sku_exists")).toBe(true);
  });

  it("builds a downloadable error report from row errors", () => {
    const report = buildErrorReportRows(
      ["name", "phone"],
      [
        ["Ravi", "98"],
        ["Ok", "9876543210"],
      ],
      [
        {
          rowNumber: 2,
          field: "phone",
          code: "import.row_invalid",
          message: "too short",
        },
      ],
    );

    expect(report).toHaveLength(1);
    expect(report[0]?.rowNumber).toBe("2");
    expect(report[0]?.errors).toContain("phone");
    expect(report[0]?.name).toBe("Ravi");
  });
});

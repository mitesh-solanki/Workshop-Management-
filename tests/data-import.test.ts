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
    expect(result.errors.some((e) => e.code === "import.duplicate_in_file")).toBe(
      true,
    );
    expect(result.errors.some((e) => e.rowNumber === 4)).toBe(true);
  });

  it("resolves vehicles by customer phone and blocks existing regs", () => {
    const phoneMap = new Map([
      [normalisePhoneKey("9876543210"), "cust-1"],
    ]);
    const result = validateImportRows(
      "vehicles",
      [
        ["9876543210", "GJ01AB1234", "Maruti", "Swift", "2019", "", "", "", ""],
        ["9999999999", "GJ01ZZ9999", "Honda", "City", "", "", "", "", ""],
        ["9876543210", "GJ01AB1234", "Maruti", "Baleno", "", "", "", "", ""],
      ],
      {
        customerPhone: 0,
        registrationNumber: 1,
        make: 2,
        model: 3,
        year: 4,
        odometer: 5,
        insuranceExpiry: 6,
        pucExpiry: 7,
        fitnessExpiry: 8,
      },
      {
        customerIdByPhone: phoneMap,
        existingRegistrations: new Set(["GJ01EXISTING"]),
      },
    );

    expect(result.entity).toBe("vehicles");
    if (result.entity !== "vehicles") {
      throw new Error("expected vehicles");
    }
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0]?.customerId).toBe("cust-1");
    expect(result.valid[0]?.registrationNumber).toBe("GJ01AB1234");
    expect(
      result.errors.some((e) => e.code === "import.customer_not_found"),
    ).toBe(true);
    expect(
      result.errors.some((e) => e.code === "import.duplicate_in_file"),
    ).toBe(true);
  });

  it("rejects vehicle when registration already exists in garage", () => {
    const result = validateImportRows(
      "vehicles",
      [["9876543210", "gj 01 ab 1234", "Maruti", "Swift", "", "", "", "", ""]],
      {
        customerPhone: 0,
        registrationNumber: 1,
        make: 2,
        model: 3,
        year: 4,
        odometer: 5,
        insuranceExpiry: 6,
        pucExpiry: 7,
        fitnessExpiry: 8,
      },
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
      { existingSkus: new Set(["PAD-EXISTING"]) },
    );

    expect(result.entity).toBe("parts");
    if (result.entity !== "parts") {
      throw new Error("expected parts");
    }
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0]?.sku).toBe("OIL-1");
    expect(result.valid[0]?.purchasePricePaise).toBe(10050);
    expect(result.valid[0]?.openingStock).toBe(10);
    expect(result.errors.some((e) => e.code === "import.duplicate_in_file")).toBe(
      true,
    );
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

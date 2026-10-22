import { describe, expect, it } from "vitest";
import { rowsToCsv } from "@/lib/csv";
import {
  customerExportColumns,
  partExportColumns,
  vehicleExportColumns,
} from "@/modules/data-export/columns";

describe("data-export columns", () => {
  it("exports customer rows matching import sample headers", () => {
    const csv = rowsToCsv(
      customerExportColumns,
      [{ name: "Ravi", phone: "9876543210", address: null, notes: "VIP" }],
      { includeBom: false, lineEnding: "\n" },
    );
    expect(csv).toBe("name,phone,address,notes\nRavi,9876543210,,VIP");
  });

  it("exports vehicle rows with ISO dates", () => {
    const csv = rowsToCsv(
      vehicleExportColumns,
      [
        {
          customerPhone: "9876543210",
          customerName: "Ravi",
          registrationNumber: "GJ01AB1234",
          make: "Maruti",
          model: "Swift",
          year: 2019,
          odometer: 1000,
          insuranceExpiry: new Date("2027-03-31T00:00:00.000Z"),
          pucExpiry: null,
          fitnessExpiry: null,
        },
      ],
      { includeBom: false, lineEnding: "\n" },
    );
    expect(csv.split("\n")[0]).toContain("customerPhone");
    expect(csv).toContain("GJ01AB1234");
    expect(csv).toContain("2027-03-31");
  });

  it("exports part prices as rupees", () => {
    const csv = rowsToCsv(
      partExportColumns,
      [
        {
          name: "Oil",
          sku: "OIL-1",
          unit: "litre",
          purchasePricePaise: 10050,
          sellingPricePaise: 15000,
          gstRatePercent: 18,
          hsn: "271019",
          lowStockLevel: 5,
          quantityOnHand: 10,
        },
      ],
      { includeBom: false, lineEnding: "\n" },
    );
    expect(csv).toContain("100.50");
    expect(csv).toContain("150");
    expect(csv).toContain("OIL-1");
  });
});

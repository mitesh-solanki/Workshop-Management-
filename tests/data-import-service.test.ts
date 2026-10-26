import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError, ForbiddenError } from "@/lib/errors";
import type { RoleSession } from "@/lib/rbac";

vi.mock("@/modules/data-import/repo", () => ({
  listCustomerPhoneIndex: vi.fn(),
  listRegistrationSet: vi.fn(),
  listSkuIndex: vi.fn(),
  importCustomersBatch: vi.fn(),
  importVehiclesBatch: vi.fn(),
  importPartsBatch: vi.fn(),
}));

import {
  importCustomersBatch,
  importPartsBatch,
  importVehiclesBatch,
  listCustomerPhoneIndex,
  listRegistrationSet,
  listSkuIndex,
} from "@/modules/data-import/repo";
import { commitImport } from "@/modules/data-import/service";
import { normalisePhoneKey } from "@/modules/data-import/validate";

const owner: RoleSession = {
  userId: "user-1",
  garageId: "garage-1",
  role: "OWNER",
};

const technician: RoleSession = {
  userId: "tech-1",
  garageId: "garage-1",
  role: "TECHNICIAN",
};

describe("data-import service commit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listSkuIndex).mockResolvedValue(new Map());
    vi.mocked(listCustomerPhoneIndex).mockResolvedValue(new Map());
    vi.mocked(listRegistrationSet).mockResolvedValue(new Set());
    vi.mocked(importCustomersBatch).mockResolvedValue({
      importedCount: 1,
      createdCount: 1,
      updatedCount: 0,
      ids: ["c1"],
    });
    vi.mocked(importPartsBatch).mockResolvedValue({
      importedCount: 1,
      createdCount: 1,
      updatedCount: 0,
      ids: ["p1"],
    });
    vi.mocked(importVehiclesBatch).mockResolvedValue({
      importedCount: 1,
      ids: ["v1"],
      customersCreated: 1,
    });
  });

  it("blocks technicians from importing", async () => {
    await expect(
      commitImport(technician, {
        entity: "customers",
        headers: ["name", "phone"],
        rows: [["Ravi", "9876543210"]],
        mapping: { name: 0, phone: 1 },
        mode: "all_or_nothing",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("refuses all-or-nothing when any row is invalid", async () => {
    await expect(
      commitImport(owner, {
        entity: "customers",
        headers: ["name", "phone"],
        rows: [
          ["Ravi", "9876543210"],
          ["Bad", "1"],
        ],
        mapping: { name: 0, phone: 1 },
        mode: "all_or_nothing",
      }),
    ).rejects.toMatchObject({
      code: "import.has_invalid_rows",
    } satisfies Partial<AppError>);
    expect(importCustomersBatch).not.toHaveBeenCalled();
  });

  it("imports only valid rows when skip_invalid is confirmed", async () => {
    const result = await commitImport(owner, {
      entity: "customers",
      headers: ["name", "phone"],
      rows: [
        ["Ravi", "9876543210"],
        ["Bad", "1"],
      ],
      mapping: { name: 0, phone: 1 },
      mode: "skip_invalid",
    });

    expect(result.importedCount).toBe(1);
    expect(result.skippedCount).toBe(1);
    expect(importCustomersBatch).toHaveBeenCalledTimes(1);
  });

  it("skips customers whose phone already exists when skip_invalid", async () => {
    vi.mocked(listCustomerPhoneIndex).mockResolvedValue(
      new Map([[normalisePhoneKey("9876543210"), "cust-1"]]),
    );

    const result = await commitImport(owner, {
      entity: "customers",
      headers: ["name", "phone"],
      rows: [
        ["Ravi", "9876543210"],
        ["New", "9000011111"],
      ],
      mapping: { name: 0, phone: 1 },
      mode: "skip_invalid",
    });

    expect(result.importedCount).toBe(1);
    expect(result.skippedCount).toBe(1);
    expect(importCustomersBatch).toHaveBeenCalledWith(
      "garage-1",
      "user-1",
      [
        expect.objectContaining({
          phone: "9000011111",
          existingCustomerId: null,
        }),
      ],
    );
  });

  it("updates existing customers when update_existing mode is used", async () => {
    vi.mocked(listCustomerPhoneIndex).mockResolvedValue(
      new Map([[normalisePhoneKey("9876543210"), "cust-1"]]),
    );
    vi.mocked(importCustomersBatch).mockResolvedValue({
      importedCount: 2,
      createdCount: 1,
      updatedCount: 1,
      ids: ["cust-1", "c2"],
    });

    const result = await commitImport(owner, {
      entity: "customers",
      headers: ["name", "phone"],
      rows: [
        ["Ravi Updated", "9876543210"],
        ["New", "9000011111"],
      ],
      mapping: { name: 0, phone: 1 },
      mode: "update_existing",
    });

    expect(result.importedCount).toBe(2);
    expect(result.updatedCount).toBe(1);
    expect(importCustomersBatch).toHaveBeenCalledWith(
      "garage-1",
      "user-1",
      expect.arrayContaining([
        expect.objectContaining({
          phone: "9876543210",
          existingCustomerId: "cust-1",
          name: "Ravi Updated",
        }),
        expect.objectContaining({
          phone: "9000011111",
          existingCustomerId: null,
        }),
      ]),
    );
  });

  it("imports vehicles and creates customer when phone is new", async () => {
    const mapping = {
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

    const result = await commitImport(owner, {
      entity: "vehicles",
      headers: [
        "customerName",
        "customerPhone",
        "customerAddress",
        "registrationNumber",
        "make",
        "model",
        "year",
        "odometer",
        "insuranceExpiry",
        "pucExpiry",
        "fitnessExpiry",
      ],
      rows: [
        [
          "New Owner",
          "9000011111",
          "Ahmedabad",
          "GJ01ZZ9999",
          "Honda",
          "City",
          "2018",
          "12000",
          "",
          "",
          "",
        ],
      ],
      mapping,
      mode: "all_or_nothing",
    });

    expect(result.importedCount).toBe(1);
    expect(result.skippedCount).toBe(0);
    expect(importVehiclesBatch).toHaveBeenCalledWith(
      "garage-1",
      "user-1",
      [
        expect.objectContaining({
          registrationNumber: "GJ01ZZ9999",
          customerId: null,
          customerCreate: expect.objectContaining({
            name: "New Owner",
            phone: "9000011111",
          }),
          make: "Honda",
          model: "City",
        }),
      ],
    );
  });

  it("updates existing parts when update_existing mode is used", async () => {
    vi.mocked(listSkuIndex).mockResolvedValue(new Map([["OIL-1", "part-1"]]));
    vi.mocked(importPartsBatch).mockResolvedValue({
      importedCount: 2,
      createdCount: 1,
      updatedCount: 1,
      ids: ["part-1", "p2"],
    });

    const mapping = {
      name: 0,
      sku: 1,
      unit: 2,
      purchasePrice: 3,
      sellingPrice: 4,
      gstRatePercent: 5,
      hsn: 6,
      lowStockLevel: 7,
      openingStock: 8,
    };

    const result = await commitImport(owner, {
      entity: "parts",
      headers: [
        "name",
        "sku",
        "unit",
        "purchase",
        "sell",
        "gst",
        "hsn",
        "low",
        "stock",
      ],
      rows: [
        ["Oil Updated", "oil-1", "litre", "110", "160", "18", "271019", "5", "99"],
        ["Pad", "PAD-NEW", "set", "200", "300", "28", "870830", "2", "0"],
      ],
      mapping,
      mode: "update_existing",
    });

    expect(result.importedCount).toBe(2);
    expect(result.updatedCount).toBe(1);
    expect(importPartsBatch).toHaveBeenCalledWith(
      "garage-1",
      "user-1",
      expect.arrayContaining([
        expect.objectContaining({
          sku: "OIL-1",
          existingPartId: "part-1",
          name: "Oil Updated",
          openingStock: 0,
        }),
        expect.objectContaining({
          sku: "PAD-NEW",
          existingPartId: null,
        }),
      ]),
    );
  });
});

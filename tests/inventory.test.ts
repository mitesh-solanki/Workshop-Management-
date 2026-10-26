import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError, ForbiddenError } from "@/lib/errors";
import type { RoleSession } from "@/lib/rbac";
import {
  assertStockChangeAllowed,
  isLowStock,
  quantityChangeForMovement,
  signedAdjustmentQuantity,
  sumStock,
} from "@/modules/inventory/stock";
import { skuFromPartName } from "@/modules/inventory/sku-from-name";

vi.mock("@/modules/inventory/repo", () => ({
  searchParts: vi.fn(),
  findPartById: vi.fn(),
  findPartBySku: vi.fn(),
  listPartMovements: vi.fn(),
  listLowStockParts: vi.fn(),
  createPart: vi.fn(),
  updatePart: vi.fn(),
  applyStockMovement: vi.fn(),
  createDirectSale: vi.fn(),
  DirectSaleTxError: class DirectSaleTxError extends Error {
    reason: string;
    partId?: string;
    constructor(reason: string, partId?: string) {
      super(reason);
      this.name = "DirectSaleTxError";
      this.reason = reason;
      this.partId = partId;
    }
  },
  findDirectSaleById: vi.fn(),
  listDirectSales: vi.fn(),
}));

import {
  applyStockMovement,
  createDirectSale,
  findPartById,
  findPartBySku,
  listLowStockParts,
} from "@/modules/inventory/repo";
import { parseDirectSaleFormData } from "@/modules/inventory/direct-sale-form-data";
import {
  createDirectSaleRecord,
  getLowStockAlerts,
  getPartForGarageId,
  recordStockAdjustment,
  recordStockOut,
} from "@/modules/inventory/service";

const garageA = "garage-a";
const garageB = "garage-b";

const ownerA: RoleSession = {
  userId: "owner-a",
  garageId: garageA,
  role: "OWNER",
};

const technicianA: RoleSession = {
  userId: "tech-a",
  garageId: garageA,
  role: "TECHNICIAN",
};

const accountantA: RoleSession = {
  userId: "acct-a",
  garageId: garageA,
  role: "ACCOUNTANT",
};

describe("stock math", () => {
  it("sums signed quantity changes as current stock", () => {
    expect(
      sumStock([
        { quantityChange: 10 },
        { quantityChange: -3 },
        { quantityChange: 2 },
        { quantityChange: -1 },
      ]),
    ).toBe(8);
  });

  it("maps IN/OUT to signed deltas", () => {
    expect(quantityChangeForMovement("IN", 5)).toBe(5);
    expect(quantityChangeForMovement("OUT", 5)).toBe(-5);
  });

  it("keeps adjustment deltas signed", () => {
    expect(signedAdjustmentQuantity(-4)).toBe(-4);
    expect(signedAdjustmentQuantity(3)).toBe(3);
  });

  it("blocks negative stock unless the garage allows it", () => {
    const blocked = assertStockChangeAllowed({
      currentStock: 2,
      quantityChange: -3,
      allowNegativeStock: false,
    });
    expect(blocked).toEqual({ ok: false, resultingStock: -1 });

    const allowed = assertStockChangeAllowed({
      currentStock: 2,
      quantityChange: -3,
      allowNegativeStock: true,
    });
    expect(allowed).toEqual({ ok: true, resultingStock: -1 });
  });

  it("flags low stock at or below the threshold", () => {
    expect(isLowStock(5, 5)).toBe(true);
    expect(isLowStock(4, 5)).toBe(true);
    expect(isLowStock(6, 5)).toBe(false);
  });
});

describe("inventory service stock guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects stock out when repo reports insufficient stock", async () => {
    vi.mocked(applyStockMovement).mockResolvedValue({
      ok: false,
      reason: "INSUFFICIENT_STOCK",
      resultingStock: -1,
    });

    await expect(
      recordStockOut(ownerA, {
        partId: "part-1",
        quantity: 5,
        note: null,
      }),
    ).rejects.toMatchObject({
      code: "inventory.insufficient_stock",
    } satisfies Partial<AppError>);
  });

  it("allows stock out when repo succeeds", async () => {
    vi.mocked(applyStockMovement).mockResolvedValue({
      ok: true,
      movement: {
        id: "m1",
        type: "OUT",
        quantityChange: -2,
        partId: "part-1",
      },
      resultingStock: 3,
    });

    const result = await recordStockOut(ownerA, {
      partId: "part-1",
      quantity: 2,
      note: "manual",
    });

    expect(result.ok).toBe(true);
    expect(applyStockMovement).toHaveBeenCalledWith(
      garageA,
      expect.objectContaining({
        partId: "part-1",
        type: "OUT",
        quantity: 2,
      }),
    );
  });

  it("rejects adjustment that would go negative when garage disallows it", async () => {
    vi.mocked(applyStockMovement).mockResolvedValue({
      ok: false,
      reason: "INSUFFICIENT_STOCK",
      resultingStock: -2,
    });

    await expect(
      recordStockAdjustment(ownerA, {
        partId: "part-1",
        quantityChange: -5,
        note: "count",
      }),
    ).rejects.toMatchObject({
      code: "inventory.insufficient_stock",
    } satisfies Partial<AppError>);
  });

  it("rejects cross-garage part reads", async () => {
    await expect(
      getPartForGarageId(ownerA, garageB, "part-1"),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(findPartById).not.toHaveBeenCalled();
  });

  it("rejects duplicate SKU on create path via existing sku lookup", async () => {
    vi.mocked(findPartBySku).mockResolvedValue({ id: "existing" });
    const { createPartRecord } = await import("@/modules/inventory/service");

    await expect(
      createPartRecord(ownerA, {
        name: "Oil filter",
        sku: "OF-1",
        unit: "pcs",
        purchasePricePaise: "100",
        sellingPricePaise: "150",
        gstRatePercent: "18",
        hsn: "87089900",
        lowStockLevel: "2",
        openingStock: "0",
      }),
    ).rejects.toMatchObject({
      code: "inventory.sku_exists",
    } satisfies Partial<AppError>);
  });

  it("allows technician to read low-stock alerts", async () => {
    vi.mocked(listLowStockParts).mockResolvedValue([
      {
        id: "part-low",
        garageId: garageA,
        name: "Pad",
        sku: "PAD-1",
        unit: "set",
        purchasePricePaise: 1000,
        sellingPricePaise: 2000,
        gstRatePercent: 18,
        hsn: "8708",
        lowStockLevel: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
        quantityOnHand: 2,
      },
    ]);

    const alerts = await getLowStockAlerts(technicianA);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.id).toBe("part-low");
    expect(listLowStockParts).toHaveBeenCalledWith(garageA);
  });
});

describe("direct sale form and multi-line create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses multiple lines and optional customer from FormData", () => {
    const formData = new FormData();
    formData.set("customerId", "cust-1");
    formData.set("notes", "Counter sale");
    formData.append("partId", "part-a");
    formData.append("quantity", "2");
    formData.append("unitPriceRupees", "100");
    formData.append("partId", "part-b");
    formData.append("quantity", "1");
    formData.append("unitPriceRupees", "50.50");

    expect(parseDirectSaleFormData(formData)).toEqual({
      customerId: "cust-1",
      walkInName: "",
      notes: "Counter sale",
      lines: [
        { partId: "part-a", quantity: "2", unitPricePaise: "100" },
        { partId: "part-b", quantity: "1", unitPricePaise: "50.50" },
      ],
    });
  });

  it("parses optional walk-in name from FormData", () => {
    const formData = new FormData();
    formData.set("customerId", "");
    formData.set("walkInName", "Ravi");
    formData.set("notes", "");
    formData.append("partId", "part-a");
    formData.append("quantity", "1");
    formData.append("unitPriceRupees", "10");

    expect(parseDirectSaleFormData(formData)).toEqual({
      customerId: "",
      walkInName: "Ravi",
      notes: "",
      lines: [{ partId: "part-a", quantity: "1", unitPricePaise: "10" }],
    });
  });

  it("creates a multi-line sale with customer via the service", async () => {
    vi.mocked(findPartById)
      .mockResolvedValueOnce({
        id: "part-a",
        garageId: garageA,
        name: "Oil",
        sku: "OIL",
        unit: "litre",
        purchasePricePaise: 5000,
        sellingPricePaise: 10000,
        gstRatePercent: 18,
        hsn: "2710",
        lowStockLevel: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        quantityOnHand: 20,
      })
      .mockResolvedValueOnce({
        id: "part-b",
        garageId: garageA,
        name: "Filter",
        sku: "FIL",
        unit: "pcs",
        purchasePricePaise: 2000,
        sellingPricePaise: 5050,
        gstRatePercent: 28,
        hsn: "8421",
        lowStockLevel: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        quantityOnHand: 5,
      });
    vi.mocked(createDirectSale).mockResolvedValue({ saleId: "sale-1" });

    const result = await createDirectSaleRecord(accountantA, {
      customerId: "cust-1",
      notes: "Walk-up",
      lines: [
        { partId: "part-a", quantity: "2", unitPricePaise: "100" },
        { partId: "part-b", quantity: "1", unitPricePaise: "50.50" },
      ],
    });

    expect(result).toEqual({ saleId: "sale-1" });
    expect(createDirectSale).toHaveBeenCalledWith(
      garageA,
      expect.objectContaining({
        customerId: "cust-1",
        walkInName: null,
        notes: "Walk-up",
        actorId: accountantA.userId,
        lines: [
          {
            partId: "part-a",
            quantity: 2,
            unitPricePaise: 10000,
            gstRatePercent: 18,
            hsn: "2710",
          },
          {
            partId: "part-b",
            quantity: 1,
            unitPricePaise: 5050,
            gstRatePercent: 28,
            hsn: "8421",
          },
        ],
      }),
    );
  });
});

/**
 * Simulates the FOR UPDATE + check pattern used in applyStockMovement:
 * concurrent OUT attempts serialize on the part lock; the second sees reduced stock.
 */
describe("concurrent stock does not oversell", () => {
  it("only one of two parallel outs succeeds when stock is scarce", async () => {
    let onHand = 10;
    let lock: Promise<void> = Promise.resolve();

    async function lockedOut(qty: number): Promise<
      | { ok: true; resultingStock: number }
      | { ok: false; reason: "INSUFFICIENT_STOCK"; resultingStock: number }
    > {
      const previous = lock;
      let release!: () => void;
      lock = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      try {
        const check = assertStockChangeAllowed({
          currentStock: onHand,
          quantityChange: -qty,
          allowNegativeStock: false,
        });
        if (!check.ok) {
          return {
            ok: false,
            reason: "INSUFFICIENT_STOCK",
            resultingStock: check.resultingStock,
          };
        }
        onHand = check.resultingStock;
        return { ok: true, resultingStock: onHand };
      } finally {
        release();
      }
    }

    const [a, b] = await Promise.all([lockedOut(6), lockedOut(6)]);
    const successes = [a, b].filter((r) => r.ok);
    const failures = [a, b].filter((r) => !r.ok);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(onHand).toBe(4);
    expect(failures[0]).toMatchObject({
      reason: "INSUFFICIENT_STOCK",
    });
  });

  it("allows both outs when combined quantity fits", async () => {
    let onHand = 10;
    let lock: Promise<void> = Promise.resolve();

    async function lockedOut(qty: number) {
      const previous = lock;
      let release!: () => void;
      lock = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      try {
        const check = assertStockChangeAllowed({
          currentStock: onHand,
          quantityChange: -qty,
          allowNegativeStock: false,
        });
        if (!check.ok) {
          return check;
        }
        onHand = check.resultingStock;
        return check;
      } finally {
        release();
      }
    }

    const [a, b] = await Promise.all([lockedOut(4), lockedOut(5)]);
    expect(a.ok && b.ok).toBe(true);
    expect(onHand).toBe(1);
  });
});

describe("skuFromPartName", () => {
  it("builds an uppercase hyphenated SKU from the part name", () => {
    expect(skuFromPartName("Air filter dsd")).toBe("AIR-FILTER-DSD");
    expect(skuFromPartName("  oil filter  ")).toBe("OIL-FILTER");
    expect(skuFromPartName("Brake Pad (Front)")).toBe("BRAKE-PAD-FRONT");
  });

  it("returns empty for blank names and truncates long names", () => {
    expect(skuFromPartName("   ")).toBe("");
    const long = "a".repeat(80);
    expect(skuFromPartName(long).length).toBe(64);
  });
});

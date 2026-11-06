import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import type { RoleSession } from "@/lib/rbac";
import { createExpenseSchema } from "@/modules/expenses/schema";

vi.mock("@/lib/audit", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/modules/expenses/repo", () => ({
  searchExpenses: vi.fn(),
  findExpenseById: vi.fn(),
  createExpense: vi.fn(),
  updateExpenseById: vi.fn(),
  markExpensePaidById: vi.fn(),
  deleteExpenseById: vi.fn(),
}));

import { writeAuditLog } from "@/lib/audit";
import {
  createExpense,
  deleteExpenseById,
  findExpenseById,
  markExpensePaidById,
  searchExpenses,
  updateExpenseById,
} from "@/modules/expenses/repo";
import {
  assertCanAccessExpenses,
  canWriteExpenses,
  createExpenseRecord,
  deleteExpenseRecord,
  listExpenses,
  markExpensePaidRecord,
  updateExpenseRecord,
} from "@/modules/expenses/service";

const garageA = "garage-a";
const garageB = "garage-b";

const ownerA: RoleSession = {
  userId: "user-a",
  garageId: garageA,
  role: "OWNER",
};

const accountantA: RoleSession = {
  userId: "acct-a",
  garageId: garageA,
  role: "ACCOUNTANT",
};

const techA: RoleSession = {
  userId: "tech-a",
  garageId: garageA,
  role: "TECHNICIAN",
};

describe("createExpenseSchema", () => {
  it("parses paid expense with method", () => {
    const parsed = createExpenseSchema.parse({
      amountRupees: "250.50",
      spentAt: "2026-11-05",
      status: "PAID",
      method: "CASH",
      category: "  Shop cleaning  ",
      note: "  Weekly  ",
    });
    expect(parsed.amountRupees).toBe(25050);
    expect(parsed.status).toBe("PAID");
    expect(parsed.category).toBe("Shop cleaning");
    expect(parsed.note).toBe("Weekly");
  });

  it("allows unpaid without method and requires method when paid", () => {
    expect(
      createExpenseSchema.safeParse({
        amountRupees: "100",
        spentAt: "2026-11-05",
        status: "UNPAID",
        method: "",
        category: "Electricity",
      }).success,
    ).toBe(true);
    expect(
      createExpenseSchema.safeParse({
        amountRupees: "100",
        spentAt: "2026-11-05",
        status: "PAID",
        method: "",
        category: "Electricity",
      }).success,
    ).toBe(false);
  });
});

describe("expenses roles and garage isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks technicians and allows owner/accountant writes", () => {
    expect(() => assertCanAccessExpenses(techA)).toThrow(ForbiddenError);
    expect(canWriteExpenses(techA)).toBe(false);
    expect(canWriteExpenses(ownerA)).toBe(true);
    expect(canWriteExpenses(accountantA)).toBe(true);
  });

  it("lists using session garageId only", async () => {
    vi.mocked(searchExpenses).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
    });

    await listExpenses(ownerA, { q: "rent" });

    expect(searchExpenses).toHaveBeenCalledWith(
      garageA,
      "rent",
      undefined,
      "ALL",
      1,
      10,
      "newest",
    );
    expect(searchExpenses).not.toHaveBeenCalledWith(
      garageB,
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });

  it("creates with session garage and audit log", async () => {
    const spentAt = new Date("2026-11-05T00:00:00.000Z");
    vi.mocked(createExpense).mockResolvedValue({
      id: "exp-1",
      amountPaise: 50000,
      spentAt,
      status: "PAID",
      method: "UPI",
      category: "Electricity",
      note: null,
      vendorId: null,
      gstSplit: "CGST_SGST",
      gstRatePercent: 0,
      billStorageKey: null,
      billContentType: null,
      billFileName: null,
      billByteSize: null,
      createdAt: spentAt,
      updatedAt: spentAt,
      vendor: null,
    });

    const result = await createExpenseRecord(ownerA, {
      amountRupees: "500",
      spentAt: "2026-11-05",
      status: "PAID",
      method: "UPI",
      category: "Electricity",
      note: "",
      vendorId: null,
      gstSplit: "CGST_SGST",
      gstRatePercent: 0,
    });

    expect(createExpense).toHaveBeenCalledWith(
      garageA,
      expect.objectContaining({
        amountPaise: 50000,
        status: "PAID",
        method: "UPI",
        category: "Electricity",
        vendorId: null,
        gstSplit: "CGST_SGST",
        gstRatePercent: 0,
        recordedById: ownerA.userId,
      }),
    );
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        garageId: garageA,
        action: "expense.created",
        entity: "Expense",
        entityId: "exp-1",
      }),
    );
    expect(result.id).toBe("exp-1");
  });

  it("marks unpaid expense paid within session garage", async () => {
    const spentAt = new Date("2026-11-05T00:00:00.000Z");
    vi.mocked(findExpenseById).mockResolvedValue({
      id: "exp-1",
      amountPaise: 10000,
      spentAt,
      status: "UNPAID",
      method: null,
      category: "Electricity",
      note: null,
      vendorId: null,
      gstSplit: "CGST_SGST",
      gstRatePercent: 0,
      billStorageKey: null,
      billContentType: null,
      billFileName: null,
      billByteSize: null,
      createdAt: spentAt,
      updatedAt: spentAt,
      vendor: null,
    });
    vi.mocked(markExpensePaidById).mockResolvedValue({
      id: "exp-1",
      amountPaise: 10000,
      spentAt,
      status: "PAID",
      method: "CASH",
      category: "Electricity",
      note: null,
      vendorId: null,
      gstSplit: "CGST_SGST",
      gstRatePercent: 0,
      billStorageKey: null,
      billContentType: null,
      billFileName: null,
      billByteSize: null,
      createdAt: spentAt,
      updatedAt: spentAt,
      vendor: null,
    });

    await markExpensePaidRecord(accountantA, {
      expenseId: "exp-1",
      method: "CASH",
      spentAt: "2026-11-05",
    });

    expect(markExpensePaidById).toHaveBeenCalledWith(
      garageA,
      "exp-1",
      expect.objectContaining({ method: "CASH" }),
    );
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "expense.marked_paid",
        entityId: "exp-1",
      }),
    );
  });

  it("updates and deletes only within session garage", async () => {
    const spentAt = new Date("2026-11-05T00:00:00.000Z");
    const row = {
      id: "exp-1",
      amountPaise: 10000,
      spentAt,
      status: "PAID" as const,
      method: "CASH" as const,
      category: "Tea & Snacks",
      note: "Tea",
      vendorId: null,
      gstSplit: "CGST_SGST" as const,
      gstRatePercent: 0,
      billStorageKey: null,
      billContentType: null,
      billFileName: null,
      billByteSize: null,
      createdAt: spentAt,
      updatedAt: spentAt,
      vendor: null,
    };
    vi.mocked(findExpenseById).mockResolvedValue(row);
    vi.mocked(updateExpenseById).mockResolvedValue(row);
    vi.mocked(deleteExpenseById).mockResolvedValue(row);

    await updateExpenseRecord(accountantA, "exp-1", {
      amountRupees: "100",
      spentAt: "2026-11-05",
      status: "PAID",
      method: "CASH",
      category: "Tea & Snacks",
      note: "Tea",
      vendorId: null,
      gstSplit: "CGST_SGST",
      gstRatePercent: 0,
    });
    await deleteExpenseRecord(accountantA, "exp-1");

    expect(updateExpenseById).toHaveBeenCalledWith(
      garageA,
      "exp-1",
      expect.objectContaining({ amountPaise: 10000, status: "PAID" }),
    );
    expect(deleteExpenseById).toHaveBeenCalledWith(garageA, "exp-1");
  });

  it("throws not found when update misses the garage row", async () => {
    vi.mocked(findExpenseById).mockResolvedValue(null);
    await expect(
      updateExpenseRecord(ownerA, "missing", {
        amountRupees: "10",
        spentAt: "2026-11-05",
        status: "PAID",
        method: "CASH",
        category: "Miscellaneous",
        note: "",
        vendorId: null,
        gstSplit: "CGST_SGST",
        gstRatePercent: 0,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

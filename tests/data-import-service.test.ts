import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError, ForbiddenError } from "@/lib/errors";
import type { RoleSession } from "@/lib/rbac";

vi.mock("@/modules/data-import/repo", () => ({
  listCustomerPhoneIndex: vi.fn(),
  listRegistrationSet: vi.fn(),
  listSkuSet: vi.fn(),
  importCustomersBatch: vi.fn(),
  importVehiclesBatch: vi.fn(),
  importPartsBatch: vi.fn(),
}));

import {
  importCustomersBatch,
  listSkuSet,
} from "@/modules/data-import/repo";
import { commitImport } from "@/modules/data-import/service";

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
    vi.mocked(listSkuSet).mockResolvedValue(new Set());
    vi.mocked(importCustomersBatch).mockResolvedValue({
      importedCount: 1,
      ids: ["c1"],
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
});

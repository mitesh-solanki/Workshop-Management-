import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError, ForbiddenError } from "@/lib/errors";
import type { RoleSession } from "@/lib/rbac";
import { createBaySchema, normalizeBayName } from "@/modules/bays/schema";

vi.mock("@/modules/bays/repo", () => ({
  searchBays: vi.fn(),
  countOpenOrdersByBayName: vi.fn(),
  findBayNameInGarage: vi.fn(),
  getNextBaySortOrder: vi.fn(),
  createBay: vi.fn(),
  findBayById: vi.fn(),
  updateBayById: vi.fn(),
  deleteBayById: vi.fn(),
}));

import {
  countOpenOrdersByBayName,
  createBay,
  deleteBayById,
  findBayById,
  findBayNameInGarage,
  getNextBaySortOrder,
  searchBays,
  updateBayById,
} from "@/modules/bays/repo";
import {
  assertCanAccessBays,
  canWriteBays,
  createBayRecord,
  deleteBayRecord,
  listBays,
  updateBayRecord,
} from "@/modules/bays/service";

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

describe("normalizeBayName", () => {
  it("trims and collapses inner spaces", () => {
    expect(normalizeBayName("  Bay   1  ")).toBe("Bay 1");
  });
});

describe("createBaySchema", () => {
  it("accepts a trimmed name", () => {
    const parsed = createBaySchema.parse({ name: "  Bay 1  " });
    expect(parsed.name).toBe("Bay 1");
  });

  it("rejects a blank name", () => {
    expect(createBaySchema.safeParse({ name: "   " }).success).toBe(false);
  });
});

describe("bays roles and garage isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks technicians from bays", () => {
    expect(() => assertCanAccessBays(techA)).toThrow(ForbiddenError);
    expect(canWriteBays(techA)).toBe(false);
    expect(canWriteBays(ownerA)).toBe(true);
  });

  it("blocks accountants from the bays page", () => {
    expect(() => assertCanAccessBays(accountantA)).toThrow(ForbiddenError);
  });

  it("lists using session garageId only and attaches open job counts", async () => {
    vi.mocked(searchBays).mockResolvedValue({
      items: [
        {
          id: "b1",
          name: "Bay 1",
          active: true,
          sortOrder: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      total: 1,
      page: 1,
      pageSize: 10,
    });
    vi.mocked(countOpenOrdersByBayName).mockResolvedValue(
      new Map([["bay 1", 2]]),
    );

    const result = await listBays(ownerA, { q: "Bay" });

    expect(searchBays).toHaveBeenCalledWith(garageA, "Bay", 1, 10, "newest");
    expect(countOpenOrdersByBayName).toHaveBeenCalledWith(garageA, ["Bay 1"]);
    expect(result.items[0]?.openJobCount).toBe(2);
    expect(searchBays).not.toHaveBeenCalledWith(
      garageB,
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });

  it("creates a bay against the session garage", async () => {
    vi.mocked(findBayNameInGarage).mockResolvedValue(null);
    vi.mocked(getNextBaySortOrder).mockResolvedValue(1);
    vi.mocked(createBay).mockResolvedValue({
      id: "b1",
      name: "Bay 1",
      active: true,
      sortOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const created = await createBayRecord(ownerA, { name: "Bay 1" });

    expect(findBayNameInGarage).toHaveBeenCalledWith(garageA, "Bay 1");
    expect(createBay).toHaveBeenCalledWith(garageA, {
      name: "Bay 1",
      actorId: ownerA.userId,
      sortOrder: 1,
    });
    expect(created.name).toBe("Bay 1");
  });

  it("rejects a name that already exists in the garage", async () => {
    vi.mocked(findBayNameInGarage).mockResolvedValue("Bay 1");

    await expect(
      createBayRecord(ownerA, { name: "Bay 1" }),
    ).rejects.toMatchObject({
      code: "bays.name_exists",
    } satisfies Partial<AppError>);
    expect(createBay).not.toHaveBeenCalled();
  });

  it("blocks technicians from creating bays", async () => {
    await expect(
      createBayRecord(techA, { name: "Bay 1" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("updates a bay name in the session garage", async () => {
    vi.mocked(findBayById).mockResolvedValue({
      id: "b1",
      name: "Bay 1",
      active: true,
      sortOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(findBayNameInGarage).mockResolvedValue(null);
    vi.mocked(updateBayById).mockResolvedValue({
      id: "b1",
      name: "Bay A",
      active: true,
      sortOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const updated = await updateBayRecord(ownerA, "b1", { name: "Bay A" });

    expect(findBayNameInGarage).toHaveBeenCalledWith(garageA, "Bay A", "b1");
    expect(updateBayById).toHaveBeenCalledWith(garageA, "b1", {
      name: "Bay A",
      actorId: ownerA.userId,
    });
    expect(updated.name).toBe("Bay A");
  });

  it("deletes a bay in the session garage", async () => {
    vi.mocked(findBayById).mockResolvedValue({
      id: "b1",
      name: "Bay 1",
      active: true,
      sortOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(deleteBayById).mockResolvedValue(true);

    await deleteBayRecord(ownerA, "b1");

    expect(deleteBayById).toHaveBeenCalledWith(garageA, "b1", {
      actorId: ownerA.userId,
      name: "Bay 1",
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { ForbiddenError } from "@/lib/errors";
import type { RoleSession } from "@/lib/rbac";
import {
  assertMediaLimits,
  DEFAULT_CHECKLIST_ITEMS,
  MAX_PHOTO_BYTES,
  MAX_VIDEO_BYTES,
} from "@/modules/inspections/schema";

vi.mock("@/lib/storage", () => ({
  buildInspectionMediaKey: vi.fn(() => "garages/garage-a/inspections/i1/items/item-1/abc.jpg"),
  createPresignedUploadUrl: vi.fn(async () => ({
    uploadUrl: "http://localhost:9000/workshop/key",
    storageKey: "garages/garage-a/inspections/i1/items/item-1/abc.jpg",
    bucket: "workshop",
  })),
  createPresignedDownloadUrl: vi.fn(
    async (key: string) => `http://localhost:9000/workshop/${key}?X-Amz-Signature=test`,
  ),
  deleteStoredObject: vi.fn(),
  storageKeyBelongsToGarage: vi.fn(
    (key: string, garageId: string) => key.startsWith(`garages/${garageId}/`),
  ),
}));

vi.mock("@/modules/service-orders/repo", () => ({
  findServiceOrderById: vi.fn(),
}));

vi.mock("@/modules/inventory/repo", () => ({
  findPartById: vi.fn(),
}));

vi.mock("@/modules/inspections/repo", () => ({
  findInspectionByServiceOrderId: vi.fn(),
  findInspectionItemById: vi.fn(),
  findSuggestedRepairById: vi.fn(),
  createInspectionWithDefaults: vi.fn(),
  updateInspectionItemById: vi.fn(),
  addCustomChecklistItem: vi.fn(),
  createSuggestedRepair: vi.fn(),
  deleteSuggestedRepairById: vi.fn(),
  createMediaRecord: vi.fn(),
  findMediaById: vi.fn(),
  deleteMediaById: vi.fn(),
}));

import { findServiceOrderById } from "@/modules/service-orders/repo";
import { findPartById } from "@/modules/inventory/repo";
import {
  createInspectionWithDefaults,
  createSuggestedRepair,
  findInspectionByServiceOrderId,
  findInspectionItemById,
  findSuggestedRepairById,
  updateInspectionItemById,
} from "@/modules/inspections/repo";
import {
  addSuggestedRepairLine,
  getInspectionForGarageId,
  getOrCreateInspection,
  removeSuggestedRepair,
  updateInspectionItem,
} from "@/modules/inspections/service";

const garageA = "garage-a";
const garageB = "garage-b";

const ownerA: RoleSession = {
  userId: "owner-a",
  garageId: garageA,
  role: "OWNER",
};

const techA: RoleSession = {
  userId: "tech-a",
  garageId: garageA,
  role: "TECHNICIAN",
};

const techOther: RoleSession = {
  userId: "tech-other",
  garageId: garageA,
  role: "TECHNICIAN",
};

const accountantA: RoleSession = {
  userId: "acct-a",
  garageId: garageA,
  role: "ACCOUNTANT",
};

const sampleOrder = {
  id: "order-1",
  garageId: garageA,
  vehicleId: "veh-1",
  customerId: "cust-1",
  status: "INSPECTION" as const,
  priority: "NORMAL" as const,
  complaint: "Noise",
  requestedServices: null,
  odometerIn: 10000,
  expectedCompletion: null,
  technicianId: "tech-a",
  bay: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  vehicle: {
    id: "veh-1",
    registrationNumber: "GJ01AB1234",
    make: "Maruti",
    model: "Swift",
    stateCode: "24",
  },
  customer: { id: "cust-1", name: "Ravi", phone: "9876543210" },
  technician: { id: "tech-a", name: "Tech", email: "t@example.com" },
  lines: [],
};

const sampleInspection = {
  id: "insp-1",
  garageId: garageA,
  serviceOrderId: "order-1",
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  items: DEFAULT_CHECKLIST_ITEMS.map((item, index) => ({
    id: `item-${index}`,
    garageId: garageA,
    inspectionId: "insp-1",
    key: item.key,
    label: item.label,
    result: null,
    notes: null,
    sortOrder: index,
    isCustom: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    media: [],
  })),
  suggestedRepairs: [],
};

describe("default checklist", () => {
  it("includes brakes, tyres, battery, lights, fluids, suspension, AC", () => {
    expect(DEFAULT_CHECKLIST_ITEMS.map((i) => i.key)).toEqual([
      "brakes",
      "tyres",
      "battery",
      "lights",
      "fluids",
      "suspension",
      "ac",
    ]);
  });
});

describe("assertMediaLimits", () => {
  it("accepts compressed jpeg photos under the limit", () => {
    expect(() =>
      assertMediaLimits("PHOTO", "image/jpeg", MAX_PHOTO_BYTES),
    ).not.toThrow();
  });

  it("rejects oversized videos", () => {
    expect(() =>
      assertMediaLimits("VIDEO", "video/mp4", MAX_VIDEO_BYTES + 1),
    ).toThrow(/too large/i);
  });
});

describe("inspection access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("seeds defaults when an owner opens inspection", async () => {
    vi.mocked(findServiceOrderById).mockResolvedValue(sampleOrder);
    vi.mocked(findInspectionByServiceOrderId).mockResolvedValue(null);
    vi.mocked(createInspectionWithDefaults).mockResolvedValue(sampleInspection);

    const inspection = await getOrCreateInspection(ownerA, "order-1");
    expect(createInspectionWithDefaults).toHaveBeenCalledWith(
      garageA,
      expect.objectContaining({ serviceOrderId: "order-1" }),
    );
    expect(inspection?.items).toHaveLength(7);
  });

  it("returns the existing inspection when create races on serviceOrderId", async () => {
    vi.mocked(findServiceOrderById).mockResolvedValue(sampleOrder);
    vi.mocked(findInspectionByServiceOrderId)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(sampleInspection);
    vi.mocked(createInspectionWithDefaults).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "6.19.3",
        meta: { target: ["serviceOrderId"] },
      }),
    );

    const inspection = await getOrCreateInspection(ownerA, "order-1");
    expect(inspection?.id).toBe(sampleInspection.id);
    expect(findInspectionByServiceOrderId).toHaveBeenCalledTimes(2);
  });

  it("blocks a technician from another assignment", async () => {
    vi.mocked(findServiceOrderById).mockResolvedValue(sampleOrder);
    await expect(getOrCreateInspection(techOther, "order-1")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("lets the assigned technician update an item", async () => {
    vi.mocked(findInspectionItemById).mockResolvedValue({
      id: "item-0",
      garageId: garageA,
      inspectionId: "insp-1",
      key: "brakes",
      label: "Brakes",
      result: null,
      notes: null,
      sortOrder: 0,
      isCustom: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      media: [],
      inspection: {
        id: "insp-1",
        garageId: garageA,
        serviceOrderId: "order-1",
      },
    });
    vi.mocked(findServiceOrderById).mockResolvedValue(sampleOrder);
    vi.mocked(updateInspectionItemById).mockResolvedValue({
      id: "item-0",
      garageId: garageA,
      inspectionId: "insp-1",
      key: "brakes",
      label: "Brakes",
      result: "URGENT",
      notes: "Pads thin",
      sortOrder: 0,
      isCustom: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      media: [],
      inspection: {
        id: "insp-1",
        garageId: garageA,
        serviceOrderId: "order-1",
      },
    });

    const updated = await updateInspectionItem(techA, "item-0", {
      result: "URGENT",
      notes: "Pads thin",
    });
    expect(updated.result).toBe("URGENT");
  });

  it("denies cross-garage inspection reads", async () => {
    await expect(
      getInspectionForGarageId(ownerA, garageB, "order-1"),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("requires part id for suggested part repairs", async () => {
    vi.mocked(findServiceOrderById).mockResolvedValue(sampleOrder);
    vi.mocked(findInspectionByServiceOrderId).mockResolvedValue(sampleInspection);

    await expect(
      addSuggestedRepairLine(ownerA, "order-1", {
        type: "PART",
        description: "Brake pads",
        quantity: "1",
        unitPricePaise: "1200",
        partId: "",
      }),
    ).rejects.toThrow();
    expect(createSuggestedRepair).not.toHaveBeenCalled();
  });

  it("saves suggested part repairs with inventory partId", async () => {
    vi.mocked(findServiceOrderById).mockResolvedValue(sampleOrder);
    vi.mocked(findInspectionByServiceOrderId).mockResolvedValue(sampleInspection);
    vi.mocked(findPartById).mockResolvedValue({
      id: "part-1",
      garageId: garageA,
      name: "Brake pads",
      sku: "PAD-1",
      unit: "pcs",
      purchasePricePaise: 80000,
      sellingPricePaise: 120000,
      gstRatePercent: 18,
      hsn: "87089900",
      lowStockLevel: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
      quantityOnHand: 4,
    });
    vi.mocked(createSuggestedRepair).mockResolvedValue({
      id: "rep-1",
      garageId: garageA,
      inspectionId: "insp-1",
      type: "PART",
      description: "Brake pads (PAD-1)",
      quantity: 1,
      unitPricePaise: 120000,
      partId: "part-1",
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const repair = await addSuggestedRepairLine(ownerA, "order-1", {
      type: "PART",
      description: "Brake pads (PAD-1)",
      quantity: "1",
      unitPricePaise: "1200",
      partId: "part-1",
    });

    expect(repair.partId).toBe("part-1");
    expect(findPartById).toHaveBeenCalledWith(garageA, "part-1");
    expect(createSuggestedRepair).toHaveBeenCalledWith(
      garageA,
      expect.objectContaining({
        type: "PART",
        partId: "part-1",
        description: "Brake pads (PAD-1)",
        unitPricePaise: 120000,
      }),
    );
  });

  it("blocks accountants from removing suggested repairs", async () => {
    vi.mocked(findSuggestedRepairById).mockResolvedValue({
      id: "rep-1",
      garageId: garageA,
      inspectionId: "insp-1",
      type: "LABOUR",
      description: "Pad change",
      quantity: 1,
      unitPricePaise: 50000,
      partId: null,
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      inspection: { id: "insp-1", serviceOrderId: "order-1" },
    });

    await expect(
      removeSuggestedRepair(accountantA, "rep-1"),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

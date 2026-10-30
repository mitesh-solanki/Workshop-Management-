import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { ForbiddenError } from "@/lib/errors";
import type { RoleSession } from "@/lib/rbac";
import {
  assertMediaLimits,
  DEFAULT_CHECKLIST_ITEMS,
  MAX_PHOTO_BYTES,
  MAX_VIDEO_BYTES,
  saveInspectionSchema,
} from "@/modules/inspections/schema";

vi.mock("@/lib/storage", () => ({
  buildInspectionMediaKey: vi.fn(() => "garages/garage-a/inspections/i1/items/item-1/abc.jpg"),
  createPresignedUploadUrl: vi.fn(async () => ({
    uploadUrl: "http://localhost:9000/workshop/key",
    storageKey: "garages/garage-a/inspections/i1/items/item-1/abc.jpg",
    method: "PUT" as const,
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

vi.mock("@/modules/customers/repo", () => ({
  findCustomerById: vi.fn(),
}));

vi.mock("@/modules/vehicles/repo", () => ({
  findVehicleById: vi.fn(),
}));

vi.mock("@/modules/inspections/repo", () => ({
  findInspectionByServiceOrderId: vi.fn(),
  findInspectionById: vi.fn(),
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
  linkInspectionToServiceOrder: vi.fn(),
  listInspections: vi.fn(),
}));

import { findServiceOrderById } from "@/modules/service-orders/repo";
import { findPartById } from "@/modules/inventory/repo";
import { findVehicleById } from "@/modules/vehicles/repo";
import {
  createInspectionWithDefaults,
  createSuggestedRepair,
  findInspectionById,
  findInspectionByServiceOrderId,
  findInspectionItemById,
  findSuggestedRepairById,
  listInspections,
  updateInspectionItemById,
} from "@/modules/inspections/repo";
import {
  addSuggestedRepairLine,
  createInspection,
  getInspectionForGarageId,
  getOrCreateInspection,
  listGarageInspections,
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
  customerId: "cust-1",
  vehicleId: "veh-1",
  serviceOrderId: "order-1",
  notes: null,
  complaint: null,
  recommendedNotes: null,
  expectedCompletion: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  customer: { id: "cust-1", name: "Ravi", phone: "9876543210" },
  vehicle: {
    id: "veh-1",
    registrationNumber: "GJ01AB1234",
    make: "Maruti",
    model: "Swift",
  },
  serviceOrder: {
    id: "order-1",
    status: "INSPECTION",
    technicianId: "tech-a",
  },
  items: [],
  suggestedRepairs: [],
};

const standaloneInspection = {
  ...sampleInspection,
  id: "insp-standalone",
  serviceOrderId: null,
  serviceOrder: null,
};

describe("legacy default checklist keys", () => {
  it("keeps historical keys for older seeded rows", () => {
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

  it("creates a standalone inspection without a job card", async () => {
    vi.mocked(findVehicleById).mockResolvedValue({
      id: "veh-1",
      garageId: garageA,
      customerId: "cust-1",
      registrationNumber: "GJ01AB1234",
      make: "Maruti",
      model: "Swift",
      stateCode: "24",
      year: null,
      odometer: null,
      insuranceExpiry: null,
      pucExpiry: null,
      fitnessExpiry: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      customer: { id: "cust-1", name: "Ravi", phone: "9876543210" },
    });
    vi.mocked(createInspectionWithDefaults).mockResolvedValue(
      standaloneInspection as never,
    );

    const inspection = await createInspection(ownerA, {
      customerId: "cust-1",
      vehicleId: "veh-1",
    });

    expect(createInspectionWithDefaults).toHaveBeenCalledWith(
      garageA,
      expect.objectContaining({
        customerId: "cust-1",
        vehicleId: "veh-1",
      }),
    );
    expect(inspection.serviceOrderId).toBeNull();
    expect(inspection.items).toHaveLength(0);
  });

  it("lists only the session garage inspections", async () => {
    vi.mocked(listInspections).mockResolvedValue({
      items: [standaloneInspection as never],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    const result = await listGarageInspections(ownerA, { page: 1 });
    expect(listInspections).toHaveBeenCalledWith(garageA, { page: 1 });
    expect(result.total).toBe(1);
  });

  it("seeds defaults when an owner opens inspection from a job card", async () => {
    vi.mocked(findServiceOrderById).mockResolvedValue(sampleOrder as never);
    vi.mocked(findInspectionByServiceOrderId).mockResolvedValue(null);
    vi.mocked(createInspectionWithDefaults).mockResolvedValue(
      sampleInspection as never,
    );

    const inspection = await getOrCreateInspection(ownerA, "order-1");
    expect(createInspectionWithDefaults).toHaveBeenCalledWith(
      garageA,
      expect.objectContaining({
        serviceOrderId: "order-1",
        customerId: "cust-1",
        vehicleId: "veh-1",
      }),
    );
    expect(inspection?.items).toHaveLength(0);
  });

  it("returns the existing inspection when create races on serviceOrderId", async () => {
    vi.mocked(findServiceOrderById).mockResolvedValue(sampleOrder as never);
    vi.mocked(findInspectionByServiceOrderId)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(sampleInspection as never);
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

  it("blocks technicians from the inspections module", async () => {
    vi.mocked(findServiceOrderById).mockResolvedValue(sampleOrder as never);
    await expect(getOrCreateInspection(techOther, "order-1")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(
      updateInspectionItem(techA, "item-0", {
        result: "URGENT",
        notes: "Pads thin",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("denies cross-garage inspection reads", async () => {
    await expect(
      getInspectionForGarageId(ownerA, garageB, "order-1"),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("requires part id for suggested part repairs", async () => {
    vi.mocked(findInspectionById).mockResolvedValue(sampleInspection as never);

    await expect(
      addSuggestedRepairLine(ownerA, "insp-1", {
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
    vi.mocked(findInspectionById).mockResolvedValue(sampleInspection as never);
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

    const repair = await addSuggestedRepairLine(ownerA, "insp-1", {
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

  it("parses optional expectedCompletion on save", () => {
    const parsed = saveInspectionSchema.parse({
      customerId: "cust-1",
      vehicleId: "veh-1",
      complaint: "",
      recommendedNotes: "",
      expectedCompletion: "2026-11-01T15:30",
      items: [],
    });
    expect(parsed.expectedCompletion).toBeInstanceOf(Date);
    expect(parsed.expectedCompletion?.getFullYear()).toBe(2026);
    expect(parsed.expectedCompletion?.getMonth()).toBe(10);
    expect(parsed.expectedCompletion?.getDate()).toBe(1);
    expect(parsed.expectedCompletion?.getHours()).toBe(15);
    expect(parsed.expectedCompletion?.getMinutes()).toBe(30);

    const empty = saveInspectionSchema.parse({
      customerId: "cust-1",
      vehicleId: "veh-1",
      complaint: "",
      recommendedNotes: "",
      expectedCompletion: "",
      items: [],
    });
    expect(empty.expectedCompletion).toBeNull();
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
      inspection: {
        id: "insp-1",
        serviceOrderId: "order-1",
        serviceOrder: {
          id: "order-1",
          status: "INSPECTION" as const,
          technicianId: "tech-a",
          technicianAssignments: [{ technicianId: "tech-a" }],
        },
      },
    } as never);

    await expect(
      removeSuggestedRepair(accountantA, "rep-1"),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

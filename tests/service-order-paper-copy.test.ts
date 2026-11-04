import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import type { RoleSession } from "@/lib/rbac";
import {
  assertPaperCopyLimits,
  MAX_PAPER_COPY_BYTES,
  MAX_PAPER_COPIES_PER_ORDER,
} from "@/modules/service-orders/schema";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/storage", () => ({
  buildServiceOrderPaperCopyKey: vi.fn(
    (input: {
      garageId: string;
      serviceOrderId: string;
      contentType: string;
    }) =>
      `garages/${input.garageId}/service-orders/${input.serviceOrderId}/paper/abc.pdf`,
  ),
  createPresignedUploadUrl: vi.fn(async () => ({
    uploadUrl: "http://localhost:9000/workshop/key",
    storageKey:
      "garages/garage-a/service-orders/order-1/paper/abc.pdf",
    method: "PUT" as const,
    bucket: "workshop",
  })),
  createPresignedDownloadUrl: vi.fn(
    async (key: string) =>
      `http://localhost:9000/workshop/${key}?X-Amz-Signature=test`,
  ),
  deleteStoredObject: vi.fn(),
  storageKeyBelongsToGarage: vi.fn(
    (key: string, garageId: string) => key.startsWith(`garages/${garageId}/`),
  ),
}));

vi.mock("@/modules/service-orders/repo", () => ({
  findServiceOrderById: vi.fn(),
  countPaperCopiesForOrder: vi.fn(),
  createPaperCopy: vi.fn(),
  deletePaperCopy: vi.fn(),
  listPaperCopiesForOrder: vi.fn(),
  replacePaperCopy: vi.fn(),
}));

import {
  createPresignedUploadUrl,
  deleteStoredObject,
} from "@/lib/storage";
import {
  countPaperCopiesForOrder,
  createPaperCopy,
  deletePaperCopy,
  findServiceOrderById,
  listPaperCopiesForOrder,
  replacePaperCopy,
} from "@/modules/service-orders/repo";
import {
  confirmPaperCopyUpload,
  createPaperCopyUploadUrl,
  listPaperCopies,
  removePaperCopyUpload,
  replacePaperCopyUpload,
} from "@/modules/service-orders/service";

const garageA = "garage-a";
const garageB = "garage-b";

const ownerA: RoleSession = {
  userId: "owner-a",
  garageId: garageA,
  role: "OWNER",
};

const ownerB: RoleSession = {
  userId: "owner-b",
  garageId: garageB,
  role: "OWNER",
};

const techA: RoleSession = {
  userId: "tech-a",
  garageId: garageA,
  role: "TECHNICIAN",
};

const sampleOrder = {
  id: "order-1",
  garageId: garageA,
  vehicleId: "vehicle-1",
  customerId: "customer-1",
  jobCardNumber: 1,
  status: "COMPLETED" as const,
  priority: "NORMAL" as const,
  complaint: "Brake noise",
  requestedServices: null,
  odometerIn: null,
  expectedCompletion: null,
  technicianId: null,
  bay: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  vehicle: {
    id: "vehicle-1",
    registrationNumber: "GJ01AB1234",
    make: "Maruti",
    model: "Swift",
    stateCode: "24",
  },
  customer: {
    id: "customer-1",
    name: "Ravi",
    phone: "9999999999",
    gstin: null,
    stateCode: "24",
  },
  technician: null,
  technicianAssignments: [],
  lines: [],
  paperCopies: [],
};

const sampleCopy = {
  id: "copy-1",
  garageId: garageA,
  serviceOrderId: "order-1",
  storageKey: "garages/garage-a/service-orders/order-1/paper/abc.pdf",
  contentType: "application/pdf",
  fileName: "job-card.pdf",
  byteSize: 1200,
  createdById: "owner-a",
  createdAt: new Date(),
};

describe("assertPaperCopyLimits", () => {
  it("accepts jpeg under the size cap", () => {
    expect(() =>
      assertPaperCopyLimits("image/jpeg", MAX_PAPER_COPY_BYTES),
    ).not.toThrow();
  });

  it("rejects unknown types and oversized files", () => {
    expect(() => assertPaperCopyLimits("text/plain", 100)).toThrow(
      "orders.paper_copy_type",
    );
    expect(() =>
      assertPaperCopyLimits("image/png", MAX_PAPER_COPY_BYTES + 1),
    ).toThrow("orders.paper_copy_too_large");
  });
});

describe("paper job card uploads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findServiceOrderById).mockResolvedValue(sampleOrder);
    vi.mocked(countPaperCopiesForOrder).mockResolvedValue(0);
    vi.mocked(createPaperCopy).mockResolvedValue(sampleCopy);
    vi.mocked(deletePaperCopy).mockResolvedValue(sampleCopy);
    vi.mocked(listPaperCopiesForOrder).mockResolvedValue([sampleCopy]);
    vi.mocked(replacePaperCopy).mockResolvedValue({
      row: {
        ...sampleCopy,
        storageKey: "garages/garage-a/service-orders/order-1/paper/new.jpg",
        contentType: "image/jpeg",
        fileName: "front.jpg",
      },
      previousStorageKey: sampleCopy.storageKey,
    });
  });

  it("creates a garage-scoped upload URL for owners", async () => {
    const result = await createPaperCopyUploadUrl(ownerA, {
      serviceOrderId: "order-1",
      contentType: "application/pdf",
      byteSize: 1200,
      fileName: "job-card.pdf",
    });
    expect(result.storageKey).toContain(`garages/${garageA}/service-orders/`);
    expect(createPresignedUploadUrl).toHaveBeenCalled();
  });

  it("blocks technicians from uploading", async () => {
    await expect(
      createPaperCopyUploadUrl(techA, {
        serviceOrderId: "order-1",
        contentType: "application/pdf",
        byteSize: 1200,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("never confirms a key from another garage", async () => {
    await expect(
      confirmPaperCopyUpload(ownerA, {
        serviceOrderId: "order-1",
        storageKey: "garages/garage-b/service-orders/order-1/paper/x.pdf",
        contentType: "application/pdf",
        byteSize: 100,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("blocks uploads once the per-order limit is reached", async () => {
    vi.mocked(countPaperCopiesForOrder).mockResolvedValue(
      MAX_PAPER_COPIES_PER_ORDER,
    );
    await expect(
      createPaperCopyUploadUrl(ownerA, {
        serviceOrderId: "order-1",
        contentType: "image/jpeg",
        byteSize: 1000,
      }),
    ).rejects.toMatchObject({ code: "orders.paper_copy_limit" });
  });

  it("writes a log row on confirm and removes storage on delete", async () => {
    const confirmed = await confirmPaperCopyUpload(ownerA, {
      serviceOrderId: "order-1",
      storageKey: sampleCopy.storageKey,
      contentType: "application/pdf",
      byteSize: 1200,
      fileName: "job-card.pdf",
    });
    expect(confirmed.id).toBe("copy-1");
    expect(createPaperCopy).toHaveBeenCalled();

    await removePaperCopyUpload(ownerA, {
      serviceOrderId: "order-1",
      paperCopyId: "copy-1",
    });
    expect(deletePaperCopy).toHaveBeenCalled();
    expect(deleteStoredObject).toHaveBeenCalledWith(sampleCopy.storageKey);
  });

  it("lists copies for staff who can view the order", async () => {
    const rows = await listPaperCopies(ownerA, "order-1");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.url).toContain("X-Amz-Signature");
  });

  it("does not leak another garage order", async () => {
    vi.mocked(findServiceOrderById).mockResolvedValue(null);
    await expect(listPaperCopies(ownerB, "order-1")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("replaces an existing page without counting a new slot", async () => {
    vi.mocked(countPaperCopiesForOrder).mockResolvedValue(
      MAX_PAPER_COPIES_PER_ORDER,
    );
    const signed = await createPaperCopyUploadUrl(ownerA, {
      serviceOrderId: "order-1",
      contentType: "image/jpeg",
      byteSize: 2000,
      replacePaperCopyId: "copy-1",
    });
    expect(signed.replacePaperCopyId).toBe("copy-1");
    expect(createPresignedUploadUrl).toHaveBeenCalled();

    const replaced = await replacePaperCopyUpload(ownerA, {
      serviceOrderId: "order-1",
      paperCopyId: "copy-1",
      storageKey: "garages/garage-a/service-orders/order-1/paper/new.jpg",
      contentType: "image/jpeg",
      byteSize: 2000,
      fileName: "front.jpg",
    });
    expect(replaced.fileName).toBe("front.jpg");
    expect(deleteStoredObject).toHaveBeenCalledWith(sampleCopy.storageKey);
  });
});

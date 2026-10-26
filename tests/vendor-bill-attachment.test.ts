import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import type { RoleSession } from "@/lib/rbac";
import {
  assertVendorBillAttachmentLimits,
  MAX_VENDOR_BILL_ATTACHMENT_BYTES,
} from "@/modules/purchases/schema";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/storage", () => ({
  buildVendorBillAttachmentKey: vi.fn(
    (input: { garageId: string; vendorBillId: string; contentType: string }) =>
      `garages/${input.garageId}/vendor-bills/${input.vendorBillId}/abc.pdf`,
  ),
  createPresignedUploadUrl: vi.fn(async () => ({
    uploadUrl: "http://localhost:9000/workshop/key",
    storageKey: "garages/garage-a/vendor-bills/bill-1/abc.pdf",
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

vi.mock("@/modules/purchases/repo", () => ({
  findVendorBillById: vi.fn(),
  setVendorBillAttachment: vi.fn(),
  clearVendorBillAttachment: vi.fn(),
}));

import {
  createPresignedUploadUrl,
  deleteStoredObject,
} from "@/lib/storage";
import {
  clearVendorBillAttachment,
  findVendorBillById,
  setVendorBillAttachment,
} from "@/modules/purchases/repo";
import {
  confirmVendorBillAttachment,
  createVendorBillAttachmentUploadUrl,
  removeVendorBillAttachment,
} from "@/modules/purchases/service";

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

const sampleBill = {
  id: "bill-1",
  garageId: garageA,
  vendorId: "vendor-1",
  purchaseOrderId: null,
  billNumber: "VB-1",
  billDate: new Date(),
  amountPaise: 10000,
  notes: null,
  attachmentStorageKey: null as string | null,
  attachmentContentType: null as string | null,
  attachmentFileName: null as string | null,
  attachmentByteSize: null as number | null,
  createdById: "owner-a",
  createdAt: new Date(),
  updatedAt: new Date(),
  vendor: { id: "vendor-1", name: "Parts Co", phone: null, gstin: null },
  purchaseOrder: null,
  payments: [],
  returns: [],
  paymentsPaise: 0,
  returnsCreditPaise: 0,
  outstandingPaise: 10000,
};

describe("vendor bill attachment limits", () => {
  it("accepts jpeg and pdf within size", () => {
    expect(() =>
      assertVendorBillAttachmentLimits("image/jpeg", 1024),
    ).not.toThrow();
    expect(() =>
      assertVendorBillAttachmentLimits("application/pdf", 1024),
    ).not.toThrow();
  });

  it("rejects wrong type and oversized files", () => {
    expect(() =>
      assertVendorBillAttachmentLimits("video/mp4", 1024),
    ).toThrow("purchases.bill_attachment_type");
    expect(() =>
      assertVendorBillAttachmentLimits(
        "application/pdf",
        MAX_VENDOR_BILL_ATTACHMENT_BYTES + 1,
      ),
    ).toThrow("purchases.bill_attachment_too_large");
  });
});

describe("vendor bill attachment service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findVendorBillById).mockResolvedValue(sampleBill);
    vi.mocked(setVendorBillAttachment).mockResolvedValue({
      bill: {
        ...sampleBill,
        attachmentStorageKey:
          "garages/garage-a/vendor-bills/bill-1/abc.pdf",
        attachmentContentType: "application/pdf",
        attachmentFileName: "bill.pdf",
        attachmentByteSize: 1200,
      },
      previousStorageKey: null,
    });
    vi.mocked(clearVendorBillAttachment).mockResolvedValue({
      bill: sampleBill,
      previousStorageKey: "garages/garage-a/vendor-bills/bill-1/old.pdf",
    });
  });

  it("issues a garage-scoped upload url for money roles", async () => {
    const signed = await createVendorBillAttachmentUploadUrl(ownerA, {
      vendorBillId: "bill-1",
      contentType: "application/pdf",
      byteSize: 1200,
      fileName: "bill.pdf",
    });
    expect(signed.storageKey).toContain(`garages/${garageA}/vendor-bills/bill-1/`);
    expect(createPresignedUploadUrl).toHaveBeenCalled();
  });

  it("blocks technicians from upload urls", async () => {
    await expect(
      createVendorBillAttachmentUploadUrl(techA, {
        vendorBillId: "bill-1",
        contentType: "application/pdf",
        byteSize: 1200,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("refuses confirm when the key is for another garage", async () => {
    await expect(
      confirmVendorBillAttachment(ownerA, {
        vendorBillId: "bill-1",
        storageKey: "garages/garage-b/vendor-bills/bill-1/abc.pdf",
        contentType: "application/pdf",
        byteSize: 1200,
        fileName: "bill.pdf",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(setVendorBillAttachment).not.toHaveBeenCalled();
  });

  it("refuses confirm when the bill id segment does not match", async () => {
    await expect(
      confirmVendorBillAttachment(ownerA, {
        vendorBillId: "bill-1",
        storageKey: "garages/garage-a/vendor-bills/other-bill/abc.pdf",
        contentType: "application/pdf",
        byteSize: 1200,
        fileName: "bill.pdf",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("confirms attachment and returns a download url", async () => {
    const result = await confirmVendorBillAttachment(ownerA, {
      vendorBillId: "bill-1",
      storageKey: "garages/garage-a/vendor-bills/bill-1/abc.pdf",
      contentType: "application/pdf",
      byteSize: 1200,
      fileName: "bill.pdf",
    });
    expect(result.attachmentStorageKey).toBe(
      "garages/garage-a/vendor-bills/bill-1/abc.pdf",
    );
    expect(result.attachmentUrl).toContain("X-Amz-Signature=test");
  });

  it("does not find bills from another garage", async () => {
    vi.mocked(findVendorBillById).mockResolvedValue(null);
    await expect(
      createVendorBillAttachmentUploadUrl(ownerB, {
        vendorBillId: "bill-1",
        contentType: "application/pdf",
        byteSize: 1200,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("removes attachment and deletes the stored object", async () => {
    await removeVendorBillAttachment(ownerA, "bill-1");
    expect(clearVendorBillAttachment).toHaveBeenCalledWith(garageA, {
      vendorBillId: "bill-1",
      actorId: ownerA.userId,
    });
    expect(deleteStoredObject).toHaveBeenCalledWith(
      "garages/garage-a/vendor-bills/bill-1/old.pdf",
    );
  });
});

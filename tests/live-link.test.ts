import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash, randomBytes } from "node:crypto";
import type { RoleSession } from "@/lib/rbac";

vi.mock("@/lib/otp", () => ({
  hashToken: vi.fn((token: string) =>
    createHash("sha256").update(token).digest("hex"),
  ),
}));

vi.mock("@/lib/email/env", () => ({
  getAppUrl: () => "http://localhost:3000",
}));

vi.mock("@/lib/rate-limit", () => ({
  consumeRateLimit: vi.fn(async () => ({
    allowed: true,
    remaining: 10,
    resetAt: new Date(Date.now() + 60_000),
  })),
  LIVE_LINK_VIEW_RATE: { limit: 60, windowMs: 15 * 60 * 1000 },
  LIVE_LINK_ACTION_RATE: { limit: 30, windowMs: 15 * 60 * 1000 },
}));

vi.mock("@/modules/service-orders/repo", () => ({
  findServiceOrderById: vi.fn(),
}));

vi.mock("@/modules/live-link/repo", () => ({
  createLiveLinkRow: vi.fn(),
  findActiveLiveLinkForOrder: vi.fn(),
  findLiveLinkByTokenHash: vi.fn(),
  findEstimateLineForLive: vi.fn(),
  loadLiveOrderSnapshot: vi.fn(),
  recordOnlineLineApproval: vi.fn(),
  revokeLiveLinksForOrder: vi.fn(),
}));

vi.mock("@/lib/storage", () => ({
  createPresignedDownloadUrl: vi.fn(async (key: string) => `https://cdn.test/${key}`),
}));

vi.mock("@/modules/payments/service", () => ({
  startUpiPaymentForLiveLink: vi.fn(),
}));

import { hashToken } from "@/lib/otp";
import { consumeRateLimit } from "@/lib/rate-limit";
import { createPresignedDownloadUrl } from "@/lib/storage";
import { findServiceOrderById } from "@/modules/service-orders/repo";
import {
  createLiveLinkRow,
  findEstimateLineForLive,
  findLiveLinkByTokenHash,
  loadLiveOrderSnapshot,
  recordOnlineLineApproval,
  revokeLiveLinksForOrder,
} from "@/modules/live-link/repo";
import {
  approveEstimateLineViaLiveLink,
  createLiveLink,
  getPublicLiveView,
  inspectLiveTokenForTests,
  revokeLiveLinkForOrder,
} from "@/modules/live-link/service";

const garageA = "garage-a";
const ownerA: RoleSession = {
  userId: "owner-a",
  garageId: garageA,
  role: "OWNER",
};

function sampleOrder() {
  return {
    id: "order-1",
    garageId: garageA,
    vehicleId: "veh-1",
    customerId: "cust-1",
    status: "IN_PROGRESS" as const,
    priority: "NORMAL" as const,
    complaint: "Noise",
    requestedServices: null,
    odometerIn: 1000,
    expectedCompletion: null,
    technicianId: null,
    bay: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function sampleLink(overrides: {
  tokenHash?: string;
  expiresAt?: Date;
  revokedAt?: Date | null;
} = {}) {
  return {
    id: "link-1",
    garageId: garageA,
    serviceOrderId: "order-1",
    tokenHash: overrides.tokenHash ?? "hash",
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 86_400_000),
    revokedAt: overrides.revokedAt ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
    garage: { id: garageA, name: "Prime Garage" },
    serviceOrder: {
      id: "order-1",
      status: "IN_PROGRESS" as const,
      expectedCompletion: null,
      vehicle: {
        registrationNumber: "GJ01AB1234",
        make: "Maruti",
        model: "Swift",
      },
    },
  };
}

describe("live link tokens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a wrong token", async () => {
    vi.mocked(findLiveLinkByTokenHash).mockResolvedValue(null);
    const result = await inspectLiveTokenForTests("totally-wrong-token-value");
    expect(result.reason).toBe("wrong_token");

    const view = await getPublicLiveView("totally-wrong-token-value", "1.1.1.1");
    expect(view.ok).toBe(false);
    if (!view.ok) {
      expect(view.reason).toBe("wrong_token");
    }
  });

  it("rejects an expired token", async () => {
    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashToken(token);
    vi.mocked(findLiveLinkByTokenHash).mockResolvedValue(
      sampleLink({
        tokenHash,
        expiresAt: new Date(Date.now() - 60_000),
      }),
    );

    const result = await inspectLiveTokenForTests(token);
    expect(result.reason).toBe("expired");

    const view = await getPublicLiveView(token, "1.1.1.1");
    expect(view.ok).toBe(false);
    if (!view.ok) {
      expect(view.reason).toBe("expired");
    }
  });

  it("rejects a reused (revoked) token after renew", async () => {
    const oldToken = randomBytes(32).toString("base64url");
    const oldHash = hashToken(oldToken);

    vi.mocked(findServiceOrderById).mockResolvedValue(sampleOrder() as never);
    vi.mocked(createLiveLinkRow).mockResolvedValue({
      id: "link-2",
      garageId: garageA,
      serviceOrderId: "order-1",
      tokenHash: "new-hash",
      expiresAt: new Date(Date.now() + 86_400_000),
      revokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await createLiveLink(ownerA, { serviceOrderId: "order-1" });
    expect(createLiveLinkRow).toHaveBeenCalled();

    vi.mocked(findLiveLinkByTokenHash).mockResolvedValue(
      sampleLink({
        tokenHash: oldHash,
        revokedAt: new Date(),
      }),
    );

    const result = await inspectLiveTokenForTests(oldToken);
    expect(result.reason).toBe("revoked");

    const view = await getPublicLiveView(oldToken, "1.1.1.1");
    expect(view.ok).toBe(false);
    if (!view.ok) {
      expect(view.reason).toBe("revoked");
    }
  });

  it("stores only the hash when creating a link", async () => {
    vi.mocked(findServiceOrderById).mockResolvedValue(sampleOrder() as never);
    vi.mocked(createLiveLinkRow).mockImplementation(async (data) => ({
      id: "link-1",
      garageId: data.garageId,
      serviceOrderId: data.serviceOrderId,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
      revokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const created = await createLiveLink(ownerA, { serviceOrderId: "order-1" });
    expect(created.token.length).toBeGreaterThanOrEqual(40);
    expect(created.url).toContain(`/live/${created.token}`);

    const savedHash = vi.mocked(createLiveLinkRow).mock.calls[0]?.[0]?.tokenHash;
    expect(savedHash).toBe(hashToken(created.token));
    expect(savedHash).not.toBe(created.token);
  });

  it("revoke marks links inactive", async () => {
    vi.mocked(findServiceOrderById).mockResolvedValue(sampleOrder() as never);
    vi.mocked(revokeLiveLinksForOrder).mockResolvedValue({ count: 1 });

    await revokeLiveLinkForOrder(ownerA, "order-1");
    expect(revokeLiveLinksForOrder).toHaveBeenCalledWith(
      garageA,
      "order-1",
      ownerA.userId,
    );
  });

  it("denies public view when rate limited", async () => {
    vi.mocked(consumeRateLimit).mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + 60_000),
    });

    const view = await getPublicLiveView(
      randomBytes(32).toString("base64url"),
      "9.9.9.9",
    );
    expect(view.ok).toBe(false);
    if (!view.ok) {
      expect(view.reason).toBe("rate_limited");
    }
    expect(findLiveLinkByTokenHash).not.toHaveBeenCalled();
  });
});

describe("live link public media", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(consumeRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 10,
      resetAt: new Date(Date.now() + 60_000),
    });
  });

  it("includes inspection photos and videos with download urls", async () => {
    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashToken(token);
    vi.mocked(findLiveLinkByTokenHash).mockResolvedValue(
      sampleLink({ tokenHash }),
    );
    vi.mocked(loadLiveOrderSnapshot).mockResolvedValue({
      order: {
        id: "order-1",
        status: "IN_PROGRESS",
        expectedCompletion: null,
        vehicle: {
          registrationNumber: "GJ01AB1234",
          make: "Maruti",
          model: "Swift",
        },
      },
      inspection: {
        id: "insp-1",
        items: [
          {
            id: "item-1",
            label: "Front bumper",
            result: "FAIL",
            media: [
              {
                id: "media-photo",
                kind: "PHOTO" as const,
                storageKey: "garages/a/photo.jpg",
                contentType: "image/jpeg",
              },
              {
                id: "media-video",
                kind: "VIDEO" as const,
                storageKey: "garages/a/clip.mp4",
                contentType: "video/mp4",
              },
            ],
          },
        ],
      },
      estimate: null,
      invoices: [],
    } as never);

    const view = await getPublicLiveView(token, "1.1.1.1");
    expect(view.ok).toBe(true);
    if (!view.ok) return;

    expect(view.view.media).toEqual([
      {
        id: "media-photo",
        kind: "PHOTO",
        url: "https://cdn.test/garages/a/photo.jpg",
        contentType: "image/jpeg",
        itemLabel: "Front bumper",
      },
      {
        id: "media-video",
        kind: "VIDEO",
        url: "https://cdn.test/garages/a/clip.mp4",
        contentType: "video/mp4",
        itemLabel: "Front bumper",
      },
    ]);
    expect(createPresignedDownloadUrl).toHaveBeenCalledTimes(2);
  });
});

describe("live link estimate approve / reject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(consumeRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 10,
      resetAt: new Date(Date.now() + 60_000),
    });
  });

  it("approves a pending estimate line via live token", async () => {
    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashToken(token);
    vi.mocked(findLiveLinkByTokenHash).mockResolvedValue(
      sampleLink({ tokenHash }),
    );
    vi.mocked(findEstimateLineForLive).mockResolvedValue({
      id: "line-1",
      estimateId: "est-1",
      approvalState: "PENDING",
      estimate: {
        id: "est-1",
        serviceOrderId: "order-1",
        supersededAt: null,
      },
    } as never);
    vi.mocked(recordOnlineLineApproval).mockResolvedValue({
      ok: true,
      approval: { id: "approval-1" },
    });

    const result = await approveEstimateLineViaLiveLink(token, "2.2.2.2", {
      lineId: "line-1",
      approvalState: "APPROVED",
    });
    expect(result).toEqual({ ok: true });
    expect(recordOnlineLineApproval).toHaveBeenCalledWith(garageA, {
      estimateId: "est-1",
      estimateLineId: "line-1",
      serviceOrderId: "order-1",
      fromState: "PENDING",
      toState: "APPROVED",
    });
  });

  it("rejects a pending estimate line via live token", async () => {
    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashToken(token);
    vi.mocked(findLiveLinkByTokenHash).mockResolvedValue(
      sampleLink({ tokenHash }),
    );
    vi.mocked(findEstimateLineForLive).mockResolvedValue({
      id: "line-2",
      estimateId: "est-1",
      approvalState: "PENDING",
      estimate: {
        id: "est-1",
        serviceOrderId: "order-1",
        supersededAt: null,
      },
    } as never);
    vi.mocked(recordOnlineLineApproval).mockResolvedValue({
      ok: true,
      approval: { id: "approval-2" },
    });

    const result = await approveEstimateLineViaLiveLink(token, "2.2.2.2", {
      lineId: "line-2",
      approvalState: "REJECTED",
    });
    expect(result).toEqual({ ok: true });
    expect(recordOnlineLineApproval).toHaveBeenCalledWith(garageA, {
      estimateId: "est-1",
      estimateLineId: "line-2",
      serviceOrderId: "order-1",
      fromState: "PENDING",
      toState: "REJECTED",
    });
  });

  it("denies approve when action rate limited", async () => {
    vi.mocked(consumeRateLimit).mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + 60_000),
    });

    await expect(
      approveEstimateLineViaLiveLink(
        randomBytes(32).toString("base64url"),
        "3.3.3.3",
        { lineId: "line-1", approvalState: "APPROVED" },
      ),
    ).rejects.toMatchObject({ code: "live.rate_limited" });
    expect(recordOnlineLineApproval).not.toHaveBeenCalled();
  });
});

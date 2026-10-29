import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError, ForbiddenError } from "@/lib/errors";
import { computeLineGst, sumLineGst } from "@/lib/gst";
import type { RoleSession } from "@/lib/rbac";
import { computeEstimateTotals } from "@/modules/estimates/totals";

vi.mock("@/modules/service-orders/repo", () => ({
  findServiceOrderById: vi.fn(),
}));

vi.mock("@/modules/inspections/repo", () => ({
  findInspectionByServiceOrderId: vi.fn(),
}));

vi.mock("@/modules/estimates/repo", () => ({
  findCurrentEstimate: vi.fn(),
  listEstimatesForOrder: vi.fn(),
  findEstimateById: vi.fn(),
  findEstimateLineById: vi.fn(),
  createEstimateWithLines: vi.fn(),
  addEstimateLine: vi.fn(),
  recordLineApproval: vi.fn(),
  EstimateStockTxError: class EstimateStockTxError extends Error {
    reason: string;
    constructor(reason: string) {
      super(reason);
      this.name = "EstimateStockTxError";
      this.reason = reason;
    }
  },
}));

import { findInspectionByServiceOrderId } from "@/modules/inspections/repo";
import { findServiceOrderById } from "@/modules/service-orders/repo";
import {
  createEstimateFromSources,
  createEstimateRevision,
  getEstimateForGarageId,
  setEstimateLineApproval,
} from "@/modules/estimates/service";
import {
  createEstimateWithLines,
  findCurrentEstimate,
  findEstimateLineById,
  listEstimatesForOrder,
  recordLineApproval,
} from "@/modules/estimates/repo";

const garageA = "garage-a";
const garageB = "garage-b";

const ownerA: RoleSession = {
  userId: "owner-a",
  garageId: garageA,
  role: "OWNER",
};

const accountantA: RoleSession = {
  userId: "acct-a",
  garageId: garageA,
  role: "ACCOUNTANT",
};

function sampleOrder(
  overrides: Partial<{
    id: string;
    status: "WAITING" | "INSPECTION" | "IN_PROGRESS" | "COMPLETED";
    technicianId: string | null;
    garageId: string;
  }> = {},
) {
  return {
    id: overrides.id ?? "order-1",
    garageId: overrides.garageId ?? garageA,
    vehicleId: "veh-1",
    customerId: "cust-1",
    status: overrides.status ?? "INSPECTION",
    priority: "NORMAL" as const,
    complaint: "Brake noise",
    requestedServices: null,
    odometerIn: 12000,
    expectedCompletion: null,
    technicianId: overrides.technicianId ?? null,
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
    technician: null,
    lines: [
      {
        id: "sol-1",
        garageId: garageA,
        serviceOrderId: "order-1",
        type: "LABOUR" as const,
        description: "Brake pad labour",
        quantity: 1,
        unitPricePaise: 50_000,
        partId: null,
        part: null,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "sol-2",
        garageId: garageA,
        serviceOrderId: "order-1",
        type: "PART" as const,
        description: "Brake pads",
        quantity: 1,
        unitPricePaise: 99_900,
        partId: null,
        part: null,
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  };
}

describe("estimate GST totals (integer paise, per-line rounding)", () => {
  it("rounds GST per line then sums (not float across lines)", () => {
    // 999 paise @ 18% → 179.82 → 180; 1001 @ 18% → 180.18 → 180
    const lines = [
      { quantity: 1, unitPricePaise: 999, gstRatePercent: 18 },
      { quantity: 1, unitPricePaise: 1001, gstRatePercent: 18 },
    ];
    expect(computeLineGst(lines[0]!).gstPaise).toBe(180);
    expect(computeLineGst(lines[1]!).gstPaise).toBe(180);

    const totals = sumLineGst(lines);
    expect(totals.taxablePaise).toBe(2000);
    expect(totals.gstPaise).toBe(360);
    expect(totals.totalPaise).toBe(2360);
  });

  it("computes labour and parts with different rates", () => {
    const labour = computeLineGst({
      quantity: 2,
      unitPricePaise: 25_000,
      gstRatePercent: 18,
    });
    expect(labour.taxablePaise).toBe(50_000);
    expect(labour.gstPaise).toBe(9_000);
    expect(labour.totalPaise).toBe(59_000);

    const part = computeLineGst({
      quantity: 1,
      unitPricePaise: 10_050,
      gstRatePercent: 28,
    });
    // 10050 * 28% = 2814 exactly
    expect(part.gstPaise).toBe(2_814);
    expect(part.totalPaise).toBe(12_864);
  });
});

describe("partial approval totals", () => {
  it("splits totals by approval state", () => {
    const lines = [
      {
        quantity: 1,
        unitPricePaise: 10_000,
        gstRatePercent: 18,
        approvalState: "APPROVED" as const,
      },
      {
        quantity: 1,
        unitPricePaise: 20_000,
        gstRatePercent: 18,
        approvalState: "PENDING" as const,
      },
      {
        quantity: 1,
        unitPricePaise: 5_000,
        gstRatePercent: 18,
        approvalState: "REJECTED" as const,
      },
    ];

    const totals = computeEstimateTotals(lines);

    expect(totals.approved.taxablePaise).toBe(10_000);
    expect(totals.approved.gstPaise).toBe(1_800);
    expect(totals.approved.totalPaise).toBe(11_800);
    expect(totals.approved.lineCount).toBe(1);

    expect(totals.pending.taxablePaise).toBe(20_000);
    expect(totals.pending.gstPaise).toBe(3_600);
    expect(totals.pending.totalPaise).toBe(23_600);

    expect(totals.rejected.taxablePaise).toBe(5_000);
    expect(totals.rejected.gstPaise).toBe(900);
    expect(totals.rejected.totalPaise).toBe(5_900);

    expect(totals.all.taxablePaise).toBe(35_000);
    expect(totals.all.gstPaise).toBe(6_300);
    expect(totals.all.totalPaise).toBe(41_300);
    expect(totals.all.lineCount).toBe(3);
  });

  it("returns zeros when no lines match a state", () => {
    const totals = computeEstimateTotals([
      {
        quantity: 1,
        unitPricePaise: 100,
        gstRatePercent: 0,
        approvalState: "PENDING",
      },
    ]);
    expect(totals.approved).toEqual({
      taxablePaise: 0,
      gstPaise: 0,
      totalPaise: 0,
      lineCount: 0,
    });
  });
});

describe("estimates service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listEstimatesForOrder).mockResolvedValue([]);
  });

  it("creates an estimate from job-card labour and parts lines only", async () => {
    const order = sampleOrder();
    vi.mocked(findServiceOrderById).mockResolvedValue(order);
    vi.mocked(findCurrentEstimate).mockResolvedValue(null);
    vi.mocked(createEstimateWithLines).mockResolvedValue({
      id: "est-1",
      garageId: garageA,
      serviceOrderId: order.id,
      revisionNumber: 1,
      notes: null,
      askPermission: false,
      permissionVia: null,
      supersededAt: null,
      createdById: ownerA.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: { id: ownerA.userId, name: "Owner", email: "o@a.test" },
      lines: [
        {
          id: "el-1",
          garageId: garageA,
          estimateId: "est-1",
          type: "LABOUR",
          description: "Brake pad labour",
          quantity: 1,
          unitPricePaise: 50_000,
          gstRatePercent: 18,
          hsnOrSac: "998714",
          approvalState: "APPROVED",
          sourceOrderLineId: "sol-1",
          sourceSuggestedRepairId: null,
          sortOrder: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      approvals: [],
    });

    const result = await createEstimateFromSources(ownerA, order.id);

    expect(createEstimateWithLines).toHaveBeenCalledWith(
      garageA,
      expect.objectContaining({
        serviceOrderId: order.id,
        revisionNumber: 1,
        askPermission: false,
        permissionVia: null,
        bootstrapApprovedLines: true,
        lines: expect.arrayContaining([
          expect.objectContaining({
            sourceOrderLineId: "sol-1",
            description: "Brake pad labour",
            approvalState: "APPROVED",
            sourceSuggestedRepairId: null,
          }),
        ]),
      }),
    );
    const created = vi.mocked(createEstimateWithLines).mock.calls[0]?.[1];
    expect(created?.lines.every((line) => line.sourceSuggestedRepairId == null)).toBe(
      true,
    );
    expect(created?.lines.every((line) => line.approvalState === "APPROVED")).toBe(
      true,
    );
    expect(result.totals.all.lineCount).toBe(1);
  });

  it("rejects create when any job-card line is still unpriced", async () => {
    const order = sampleOrder();
    order.lines = [
      {
        ...order.lines[0]!,
        unitPricePaise: 50_000,
      },
      {
        ...order.lines[1]!,
        unitPricePaise: 0,
      },
    ];
    vi.mocked(findServiceOrderById).mockResolvedValue(order);
    vi.mocked(findCurrentEstimate).mockResolvedValue(null);

    await expect(createEstimateFromSources(ownerA, order.id)).rejects.toMatchObject({
      code: "ESTIMATE_NO_PRICED_SOURCES",
    } satisfies Partial<AppError>);
    expect(createEstimateWithLines).not.toHaveBeenCalled();
  });

  it("keeps lines pending when customer permission is required", async () => {
    const order = sampleOrder();
    vi.mocked(findServiceOrderById).mockResolvedValue(order);
    vi.mocked(findCurrentEstimate).mockResolvedValue(null);
    vi.mocked(createEstimateWithLines).mockResolvedValue({
      id: "est-1",
      garageId: garageA,
      serviceOrderId: order.id,
      revisionNumber: 1,
      notes: null,
      askPermission: true,
      permissionVia: "LIVE_LINK",
      supersededAt: null,
      createdById: ownerA.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: { id: ownerA.userId, name: "Owner", email: "o@a.test" },
      lines: [
        {
          id: "el-1",
          garageId: garageA,
          estimateId: "est-1",
          type: "LABOUR",
          description: "Brake pad labour",
          quantity: 1,
          unitPricePaise: 50_000,
          gstRatePercent: 18,
          hsnOrSac: "998714",
          approvalState: "PENDING",
          sourceOrderLineId: "sol-1",
          sourceSuggestedRepairId: null,
          sortOrder: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      approvals: [],
    });

    await createEstimateFromSources(ownerA, order.id, {
      askPermission: "yes",
      permissionVia: "LIVE_LINK",
    });

    expect(createEstimateWithLines).toHaveBeenCalledWith(
      garageA,
      expect.objectContaining({
        askPermission: true,
        permissionVia: "LIVE_LINK",
        bootstrapApprovedLines: false,
        lines: expect.arrayContaining([
          expect.objectContaining({
            approvalState: "PENDING",
          }),
        ]),
      }),
    );
  });

  it("blocks accountants from creating estimates", async () => {
    vi.mocked(findServiceOrderById).mockResolvedValue(sampleOrder());
    await expect(
      createEstimateFromSources(accountantA, "order-1"),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("records line approval with method and actor", async () => {
    const order = sampleOrder();
    vi.mocked(findEstimateLineById).mockResolvedValue({
      id: "el-1",
      garageId: garageA,
      estimateId: "est-1",
      type: "LABOUR",
      description: "Brake pad labour",
      quantity: 1,
      unitPricePaise: 50_000,
      gstRatePercent: 18,
      hsnOrSac: "998714",
      approvalState: "PENDING",
      sourceOrderLineId: "sol-1",
      sourceSuggestedRepairId: null,
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      estimate: {
        id: "est-1",
        serviceOrderId: order.id,
        supersededAt: null,
        revisionNumber: 1,
      },
    });
    vi.mocked(findServiceOrderById).mockResolvedValue(order);
    vi.mocked(recordLineApproval).mockResolvedValue({
      ok: true,
      line: {
        id: "el-1",
        garageId: garageA,
        estimateId: "est-1",
        type: "LABOUR",
        description: "Brake pad labour",
        quantity: 1,
        unitPricePaise: 50_000,
        gstRatePercent: 18,
        hsnOrSac: "998714",
        approvalState: "APPROVED",
        sourceOrderLineId: "sol-1",
        sourceSuggestedRepairId: null,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      approval: {
        id: "ea-1",
        garageId: garageA,
        estimateId: "est-1",
        estimateLineId: "el-1",
        fromState: "PENDING",
        toState: "APPROVED",
        method: "PHONE",
        recordedById: ownerA.userId,
        note: "Customer said yes",
        createdAt: new Date(),
        recordedBy: { id: ownerA.userId, name: "Owner", email: "o@a.test" },
      },
    });

    const result = await setEstimateLineApproval(ownerA, "el-1", {
      approvalState: "APPROVED",
      method: "PHONE",
      note: "Customer said yes",
    });

    expect(recordLineApproval).toHaveBeenCalledWith(
      garageA,
      expect.objectContaining({
        fromState: "PENDING",
        toState: "APPROVED",
        method: "PHONE",
        recordedById: ownerA.userId,
        note: "Customer said yes",
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.line.approvalState).toBe("APPROVED");
    }
  });

  it("blocks approving a part line when stock is short", async () => {
    const order = sampleOrder();
    vi.mocked(findEstimateLineById).mockResolvedValue({
      id: "el-part",
      garageId: garageA,
      estimateId: "est-1",
      type: "PART",
      description: "Oil filter",
      quantity: 1,
      unitPricePaise: 20_000,
      gstRatePercent: 18,
      hsnOrSac: "87089900",
      approvalState: "PENDING",
      sourceOrderLineId: "sol-part",
      sourceSuggestedRepairId: null,
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      estimate: {
        id: "est-1",
        serviceOrderId: order.id,
        supersededAt: null,
        revisionNumber: 1,
      },
    });
    vi.mocked(findServiceOrderById).mockResolvedValue(order);
    vi.mocked(recordLineApproval).mockResolvedValue({
      ok: false,
      reason: "INSUFFICIENT_STOCK",
    });

    await expect(
      setEstimateLineApproval(ownerA, "el-part", {
        approvalState: "APPROVED",
        method: "MANUAL",
        note: null,
      }),
    ).rejects.toMatchObject({ code: "inventory.insufficient_stock" });
  });

  it("creates a revision without deleting the previous estimate", async () => {
    const order = sampleOrder();
    const current = {
      id: "est-1",
      garageId: garageA,
      serviceOrderId: order.id,
      revisionNumber: 1,
      notes: null,
      askPermission: false,
      permissionVia: null,
      supersededAt: null,
      createdById: ownerA.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: { id: ownerA.userId, name: "Owner", email: "o@a.test" },
      lines: [
        {
          id: "el-1",
          garageId: garageA,
          estimateId: "est-1",
          type: "LABOUR" as const,
          description: "Brake pad labour",
          quantity: 1,
          unitPricePaise: 50_000,
          gstRatePercent: 18,
          hsnOrSac: "998714",
          approvalState: "APPROVED" as const,
          sourceOrderLineId: "sol-1",
          sourceSuggestedRepairId: null,
          sortOrder: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      approvals: [],
    };

    vi.mocked(findServiceOrderById).mockResolvedValue(order);
    vi.mocked(findCurrentEstimate).mockResolvedValue(current);
    vi.mocked(findInspectionByServiceOrderId).mockResolvedValue(null);
    vi.mocked(createEstimateWithLines).mockResolvedValue({
      ...current,
      id: "est-2",
      revisionNumber: 2,
      lines: current.lines.map((line) => ({ ...line, estimateId: "est-2" })),
    });

    await createEstimateRevision(ownerA, order.id, {
      notes: "Extra work",
    });

    expect(createEstimateWithLines).toHaveBeenCalledWith(
      garageA,
      expect.objectContaining({
        revisionNumber: 2,
        supersedeEstimateId: "est-1",
        notes: "Extra work",
        askPermission: false,
        permissionVia: null,
        bootstrapApprovedLines: false,
        lines: [
          expect.objectContaining({
            description: "Brake pad labour",
            approvalState: "APPROVED",
            sourceOrderLineId: "sol-1",
          }),
        ],
      }),
    );
    const call = vi.mocked(createEstimateWithLines).mock.calls[0]?.[1];
    expect(call?.lines).toHaveLength(1);
  });

  it("rejects cross-garage estimate reads", async () => {
    await expect(
      getEstimateForGarageId(ownerA, garageB, "order-1"),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("requires sources before creating the first estimate", async () => {
    const order = sampleOrder();
    order.lines = [];
    vi.mocked(findServiceOrderById).mockResolvedValue(order);
    vi.mocked(findCurrentEstimate).mockResolvedValue(null);
    vi.mocked(findInspectionByServiceOrderId).mockResolvedValue(null);

    await expect(
      createEstimateFromSources(ownerA, order.id),
    ).rejects.toMatchObject({
      code: "ESTIMATE_NO_SOURCES",
    } satisfies Partial<AppError>);
  });
});

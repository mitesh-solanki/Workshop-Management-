import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError, ForbiddenError } from "@/lib/errors";
import type { RoleSession } from "@/lib/rbac";
import {
  addServiceOrderLineSchema,
  canTransitionStatus,
  computeBayOccupancy,
  countOrdersByStatus,
  createServiceOrderSchema,
  STATUS_TRANSITIONS,
} from "@/modules/service-orders/schema";

vi.mock("@/modules/vehicles/repo", () => ({
  findVehicleById: vi.fn(),
}));

vi.mock("@/modules/bays/repo", () => ({
  findBayById: vi.fn(),
}));

vi.mock("@/modules/service-orders/repo", () => ({
  listTechniciansInGarage: vi.fn(),
  findTechnicianInGarage: vi.fn(),
  listServiceOrders: vi.fn(),
  listServiceOrdersByCustomer: vi.fn(),
  findServiceOrderById: vi.fn(),
  createServiceOrder: vi.fn(),
  updateServiceOrderStatus: vi.fn(),
  createServiceOrderLine: vi.fn(),
  deleteServiceOrderLine: vi.fn(),
  listServiceOrderAuditLogs: vi.fn(),
}));

import { findBayById } from "@/modules/bays/repo";
import { findVehicleById } from "@/modules/vehicles/repo";
import {
  createServiceOrder,
  createServiceOrderLine,
  deleteServiceOrderLine,
  findServiceOrderById,
  findTechnicianInGarage,
  listServiceOrders,
  listServiceOrdersByCustomer,
  updateServiceOrderStatus,
} from "@/modules/service-orders/repo";
import {
  addOrderLine,
  changeOrderStatus,
  changeOrderStatusForGarageId,
  createOrder,
  getOrder,
  getOrderForGarageId,
  listCustomerServiceHistory,
  listOrders,
  removeOrderLine,
} from "@/modules/service-orders/service";

const garageA = "garage-a";
const garageB = "garage-b";

const ownerA: RoleSession = {
  userId: "owner-a",
  garageId: garageA,
  role: "OWNER",
};

const managerA: RoleSession = {
  userId: "manager-a",
  garageId: garageA,
  role: "MANAGER",
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

const sampleVehicle = {
  id: "veh-1",
  garageId: garageA,
  customerId: "cust-1",
  registrationNumber: "GJ01AB1234",
  make: "Maruti",
  model: "Swift",
  stateCode: "24",
  year: 2020,
  odometer: 12000,
  insuranceExpiry: null,
  pucExpiry: null,
  fitnessExpiry: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  customer: { id: "cust-1", name: "Ravi", phone: "9876543210" },
};

function sampleOrder(
  overrides: Partial<{
    id: string;
    status: "WAITING" | "INSPECTION" | "IN_PROGRESS" | "WAITING_FOR_PARTS" | "READY" | "COMPLETED";
    priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
    technicianId: string | null;
    customerId: string;
    garageId: string;
    bay: string | null;
  }> = {},
) {
  const customerId = overrides.customerId ?? "cust-1";
  return {
    id: overrides.id ?? "order-1",
    garageId: overrides.garageId ?? garageA,
    vehicleId: "veh-1",
    customerId,
    status: overrides.status ?? ("WAITING" as const),
    priority: overrides.priority ?? ("NORMAL" as const),
    complaint: "Engine noise",
    requestedServices: "Oil change",
    odometerIn: 12000,
    expectedCompletion: null,
    technicianId: overrides.technicianId === undefined ? "tech-a" : overrides.technicianId,
    bay: overrides.bay === undefined ? "Bay 1" : overrides.bay,
    createdAt: new Date(),
    updatedAt: new Date(),
    vehicle: {
      id: "veh-1",
      registrationNumber: "GJ01AB1234",
      make: "Maruti",
      model: "Swift",
      stateCode: "24",
    },
    customer: { id: customerId, name: "Ravi", phone: "9876543210" },
    technician: {
      id: "tech-a",
      name: "Amit",
      email: "amit@example.com",
    },
    lines: [],
  };
}

describe("status transition rules", () => {
  it("allows the documented workshop flow", () => {
    expect(canTransitionStatus("WAITING", "INSPECTION")).toBe(true);
    expect(canTransitionStatus("WAITING", "IN_PROGRESS")).toBe(true);
    expect(canTransitionStatus("INSPECTION", "IN_PROGRESS")).toBe(true);
    expect(canTransitionStatus("IN_PROGRESS", "WAITING_FOR_PARTS")).toBe(true);
    expect(canTransitionStatus("WAITING_FOR_PARTS", "READY")).toBe(true);
    expect(canTransitionStatus("READY", "COMPLETED")).toBe(true);
  });

  it("rejects skips and reverse from completed", () => {
    expect(canTransitionStatus("WAITING", "READY")).toBe(false);
    expect(canTransitionStatus("WAITING", "COMPLETED")).toBe(false);
    expect(canTransitionStatus("COMPLETED", "READY")).toBe(false);
    expect(canTransitionStatus("COMPLETED", "WAITING")).toBe(false);
    expect(canTransitionStatus("READY", "WAITING")).toBe(false);
  });

  it("does not allow staying on the same status", () => {
    expect(canTransitionStatus("WAITING", "WAITING")).toBe(false);
  });

  it("has no outgoing transitions from COMPLETED", () => {
    expect(STATUS_TRANSITIONS.COMPLETED).toEqual([]);
  });
});

describe("create and status change", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates an order with session garageId and initial WAITING audit", async () => {
    vi.mocked(findVehicleById).mockResolvedValue(sampleVehicle);
    vi.mocked(findTechnicianInGarage).mockResolvedValue({
      id: "tech-a",
      name: "Amit",
      email: "amit@example.com",
      role: "TECHNICIAN",
    });
    vi.mocked(createServiceOrder).mockResolvedValue(sampleOrder());

    await createOrder(ownerA, {
      vehicleId: "veh-1",
      complaint: "Engine noise",
      requestedServices: "Oil change",
      odometerIn: 12000,
      expectedCompletion: null,
      technicianId: "tech-a",
      bay: "Bay 1",
      priority: "HIGH",
    });

    expect(createServiceOrder).toHaveBeenCalledWith(
      garageA,
      expect.objectContaining({
        vehicleId: "veh-1",
        customerId: "cust-1",
        complaint: "Engine noise",
        technicianId: "tech-a",
        priority: "HIGH",
        actorId: "owner-a",
      }),
    );
  });

  it("rejects invalid status transitions", async () => {
    vi.mocked(findServiceOrderById).mockResolvedValue(sampleOrder());

    await expect(
      changeOrderStatus(ownerA, "order-1", { status: "COMPLETED" }),
    ).rejects.toMatchObject({
      code: "INVALID_STATUS_TRANSITION",
    } satisfies Partial<AppError>);

    expect(updateServiceOrderStatus).not.toHaveBeenCalled();
  });

  it("writes a status change through the repo with actor id", async () => {
    vi.mocked(findServiceOrderById).mockResolvedValue(sampleOrder());
    vi.mocked(updateServiceOrderStatus).mockResolvedValue(
      sampleOrder({ status: "INSPECTION" }),
    );

    await changeOrderStatus(managerA, "order-1", { status: "INSPECTION" });

    expect(updateServiceOrderStatus).toHaveBeenCalledWith(garageA, "order-1", {
      from: "WAITING",
      to: "INSPECTION",
      actorId: "manager-a",
    });
  });
});

describe("role limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists only assigned orders for a technician", async () => {
    vi.mocked(listServiceOrders).mockResolvedValue([sampleOrder()]);

    await listOrders(techA);

    expect(listServiceOrders).toHaveBeenCalledWith(garageA, {
      technicianId: "tech-a",
    });
  });

  it("lists all garage orders for owner and accountant", async () => {
    vi.mocked(listServiceOrders).mockResolvedValue([]);

    await listOrders(ownerA);
    expect(listServiceOrders).toHaveBeenCalledWith(garageA, {});

    vi.clearAllMocks();
    vi.mocked(listServiceOrders).mockResolvedValue([]);
    await listOrders(accountantA);
    expect(listServiceOrders).toHaveBeenCalledWith(garageA, {});
  });

  it("blocks technicians from viewing another technician's order", async () => {
    vi.mocked(findServiceOrderById).mockResolvedValue(
      sampleOrder({ technicianId: "tech-a" }),
    );

    await expect(getOrder(techOther, "order-1")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("allows a technician to view their assigned order", async () => {
    vi.mocked(findServiceOrderById).mockResolvedValue(
      sampleOrder({ technicianId: "tech-a" }),
    );

    const order = await getOrder(techA, "order-1");
    expect(order.id).toBe("order-1");
  });

  it("blocks technicians from changing an unassigned order", async () => {
    vi.mocked(findServiceOrderById).mockResolvedValue(
      sampleOrder({ technicianId: "tech-a" }),
    );

    await expect(
      changeOrderStatus(techOther, "order-1", { status: "INSPECTION" }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(updateServiceOrderStatus).not.toHaveBeenCalled();
  });

  it("blocks accountants from creating orders", async () => {
    await expect(
      createOrder(accountantA, {
        vehicleId: "veh-1",
        complaint: "Noise",
        requestedServices: null,
        odometerIn: null,
        expectedCompletion: null,
        technicianId: null,
        bay: null,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(createServiceOrder).not.toHaveBeenCalled();
  });

  it("blocks accountants from changing status", async () => {
    await expect(
      changeOrderStatus(accountantA, "order-1", { status: "INSPECTION" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("blocks accountants from adding lines", async () => {
    await expect(
      addOrderLine(accountantA, "order-1", {
        type: "LABOUR",
        description: "Labour",
        quantity: 1,
        unitPricePaise: "100",
        partId: null,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(createServiceOrderLine).not.toHaveBeenCalled();
  });

  it("lets technicians create orders assigned to themselves", async () => {
    vi.mocked(findVehicleById).mockResolvedValue(sampleVehicle);
    vi.mocked(findTechnicianInGarage).mockResolvedValue({
      id: "tech-a",
      name: "Ravi",
      email: "ravi@example.com",
      role: "TECHNICIAN",
    });
    vi.mocked(createServiceOrder).mockResolvedValue(
      sampleOrder({ technicianId: "tech-a" }),
    );

    await createOrder(techA, {
      vehicleId: "veh-1",
      complaint: "Noise",
      requestedServices: null,
      odometerIn: null,
      expectedCompletion: null,
      technicianId: null,
      bay: null,
      priority: "NORMAL",
    });

    expect(createServiceOrder).toHaveBeenCalledWith(
      garageA,
      expect.objectContaining({
        technicianId: "tech-a",
        actorId: "tech-a",
      }),
    );
  });

  it("forces technician labour/part lines to zero price without changing owner pricing", async () => {
    vi.mocked(findServiceOrderById).mockResolvedValue(
      sampleOrder({ technicianId: "tech-a" }),
    );
    vi.mocked(createServiceOrderLine).mockResolvedValue({
      ok: true,
      line: {
        id: "line-1",
        garageId: garageA,
        serviceOrderId: "order-1",
        type: "LABOUR",
        description: "Pad change",
        quantity: 1,
        unitPricePaise: 0,
        partId: null,
        sortOrder: 0,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    });

    await addOrderLine(techA, "order-1", {
      type: "LABOUR",
      description: "Pad change",
      quantity: 1,
      unitPricePaise: "999",
      partId: null,
    });

    expect(createServiceOrderLine).toHaveBeenCalledWith(
      garageA,
      expect.objectContaining({
        unitPricePaise: 0,
        actorId: "tech-a",
      }),
    );

    vi.mocked(createServiceOrderLine).mockClear();
    vi.mocked(findServiceOrderById).mockResolvedValue(sampleOrder());
    vi.mocked(createServiceOrderLine).mockResolvedValue({
      ok: true,
      line: {
        id: "line-2",
        garageId: garageA,
        serviceOrderId: "order-1",
        type: "LABOUR",
        description: "Pad change",
        quantity: 1,
        unitPricePaise: 99900,
        partId: null,
        sortOrder: 0,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    });

    await addOrderLine(ownerA, "order-1", {
      type: "LABOUR",
      description: "Pad change",
      quantity: 1,
      unitPricePaise: "999",
      partId: null,
    });

    expect(createServiceOrderLine).toHaveBeenCalledWith(
      garageA,
      expect.objectContaining({
        unitPricePaise: 99900,
        actorId: "owner-a",
      }),
    );
  });

  it("blocks changes on completed orders", async () => {
    vi.mocked(findServiceOrderById).mockResolvedValue(
      sampleOrder({ status: "COMPLETED", technicianId: "tech-a" }),
    );

    await expect(
      changeOrderStatus(ownerA, "order-1", { status: "READY" }),
    ).rejects.toMatchObject({
      code: "ORDER_COMPLETED",
    } satisfies Partial<AppError>);

    await expect(
      addOrderLine(techA, "order-1", {
        type: "PART",
        description: "Filter",
        quantity: 1,
        unitPricePaise: "50",
        partId: null,
      }),
    ).rejects.toMatchObject({
      code: "ORDER_COMPLETED",
    } satisfies Partial<AppError>);
  });

  it("rejects cross-garage order reads and status changes", async () => {
    await expect(
      getOrderForGarageId(ownerA, garageB, "order-1"),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await expect(
      changeOrderStatusForGarageId(ownerA, garageB, "order-1", {
        status: "INSPECTION",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(findServiceOrderById).not.toHaveBeenCalled();
    expect(updateServiceOrderStatus).not.toHaveBeenCalled();
  });

  it("lets managers filter the board by technician", async () => {
    vi.mocked(listServiceOrders).mockResolvedValue([sampleOrder()]);

    await listOrders(managerA, { technicianId: "tech-a" });

    expect(listServiceOrders).toHaveBeenCalledWith(garageA, {
      technicianId: "tech-a",
    });
  });

  it("lets managers filter the board by bay", async () => {
    vi.mocked(listServiceOrders).mockResolvedValue([sampleOrder()]);

    await listOrders(managerA, { bay: "Bay 1" });

    expect(listServiceOrders).toHaveBeenCalledWith(garageA, {
      bay: "Bay 1",
    });
  });

  it("lets managers filter the board by bayId mapped to bay name", async () => {
    vi.mocked(findBayById).mockResolvedValue({
      id: "bay-1",
      name: "Bay 1",
      active: true,
      sortOrder: 0,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    });
    vi.mocked(listServiceOrders).mockResolvedValue([sampleOrder()]);

    await listOrders(managerA, { bayId: "bay-1" });

    expect(findBayById).toHaveBeenCalledWith(garageA, "bay-1");
    expect(listServiceOrders).toHaveBeenCalledWith(garageA, {
      bay: "Bay 1",
    });
  });

  it("ignores unknown bayId when filtering the board", async () => {
    vi.mocked(findBayById).mockResolvedValue(null);
    vi.mocked(listServiceOrders).mockResolvedValue([sampleOrder()]);

    await listOrders(managerA, { bayId: "missing-bay" });

    expect(listServiceOrders).toHaveBeenCalledWith(garageA, {});
  });

  it("combines technician and bay filters", async () => {
    vi.mocked(listServiceOrders).mockResolvedValue([sampleOrder()]);

    await listOrders(managerA, { technicianId: "tech-a", bay: "Bay 2" });

    expect(listServiceOrders).toHaveBeenCalledWith(garageA, {
      technicianId: "tech-a",
      bay: "Bay 2",
    });
  });

  it("ignores technician filter for technician sessions", async () => {
    vi.mocked(listServiceOrders).mockResolvedValue([sampleOrder()]);

    await listOrders(techA, { technicianId: "tech-other" });

    expect(listServiceOrders).toHaveBeenCalledWith(garageA, {
      technicianId: "tech-a",
    });
  });

  it("applies bay filter for technician sessions on their own jobs", async () => {
    vi.mocked(listServiceOrders).mockResolvedValue([sampleOrder()]);

    await listOrders(techA, { bay: "Bay 1", technicianId: "tech-other" });

    expect(listServiceOrders).toHaveBeenCalledWith(garageA, {
      technicianId: "tech-a",
      bay: "Bay 1",
    });
  });
});

describe("bay occupancy", () => {
  it("groups active orders by bay and skips completed and empty bays", () => {
    const occupancy = computeBayOccupancy([
      sampleOrder({ id: "1", bay: "Bay 1", status: "IN_PROGRESS" }),
      sampleOrder({
        id: "2",
        bay: "Bay 1",
        status: "WAITING",
        priority: "HIGH",
      }),
      sampleOrder({ id: "3", bay: "Bay 2", status: "READY" }),
      sampleOrder({ id: "4", bay: "Bay 2", status: "COMPLETED" }),
      sampleOrder({ id: "5", bay: null, status: "INSPECTION" }),
    ]);

    expect(occupancy).toEqual([
      {
        bay: "Bay 1",
        count: 2,
        registrationNumbers: ["GJ01AB1234", "GJ01AB1234"],
      },
      {
        bay: "Bay 2",
        count: 1,
        registrationNumbers: ["GJ01AB1234"],
      },
    ]);
  });
});

describe("countOrdersByStatus", () => {
  it("tallies each status for dashboard tiles", () => {
    expect(
      countOrdersByStatus([
        sampleOrder({ status: "WAITING" }),
        sampleOrder({ status: "WAITING" }),
        sampleOrder({ status: "READY" }),
        sampleOrder({ status: "COMPLETED" }),
      ]),
    ).toEqual({
      WAITING: 2,
      INSPECTION: 0,
      IN_PROGRESS: 0,
      WAITING_FOR_PARTS: 0,
      READY: 1,
      COMPLETED: 1,
    });
  });
});

describe("listCustomerServiceHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads customer history for owners via garage-scoped repo", async () => {
    const history = [
      {
        id: "order-1",
        status: "WAITING" as const,
        complaint: "Noise",
        createdAt: new Date("2026-01-01"),
        expectedCompletion: null,
        vehicle: { id: "veh-1", registrationNumber: "GJ01AB1234" },
      },
    ];
    vi.mocked(listServiceOrdersByCustomer).mockResolvedValue(history);

    const result = await listCustomerServiceHistory(ownerA, "cust-1");

    expect(listServiceOrdersByCustomer).toHaveBeenCalledWith(garageA, "cust-1");
    expect(result).toEqual(history);
  });

  it("returns only assigned orders for a technician on that customer", async () => {
    vi.mocked(listServiceOrders).mockResolvedValue([
      sampleOrder({
        id: "mine",
        technicianId: "tech-a",
        customerId: "cust-1",
      }),
      sampleOrder({
        id: "other-customer",
        technicianId: "tech-a",
        customerId: "cust-2",
      }),
    ]);

    const result = await listCustomerServiceHistory(techA, "cust-1");

    expect(listServiceOrders).toHaveBeenCalledWith(garageA, {
      technicianId: "tech-a",
    });
    expect(listServiceOrdersByCustomer).not.toHaveBeenCalled();
    expect(result).toEqual([
      {
        id: "mine",
        status: "WAITING",
        complaint: "Engine noise",
        createdAt: expect.any(Date),
        expectedCompletion: null,
        vehicle: { id: "veh-1", registrationNumber: "GJ01AB1234" },
      },
    ]);
  });
});

describe("removeOrderLine approved estimate guard", () => {
  it("blocks deleting a part line approved on the current estimate", async () => {
    vi.mocked(findServiceOrderById).mockResolvedValue(sampleOrder());
    vi.mocked(deleteServiceOrderLine).mockResolvedValue({
      ok: false,
      reason: "APPROVED_ON_ESTIMATE",
    });

    await expect(removeOrderLine(ownerA, "order-1", "sol-1")).rejects.toMatchObject({
      code: "orders.line_approved_on_estimate",
    } satisfies Partial<AppError>);
  });
});

describe("service order schema i18n messages", () => {
  it("uses validation keys for invalid odometer, date and quantity", () => {
    const odometer = createServiceOrderSchema.safeParse({
      vehicleId: "veh-1",
      complaint: "Noise",
      odometerIn: -1,
      requestedServices: "",
      expectedCompletion: "",
      technicianId: "",
      bay: "",
      priority: "",
    });
    expect(odometer.success).toBe(false);
    if (!odometer.success) {
      expect(
        odometer.error.issues.map((issue) => issue.message),
      ).toContain("validation.invalidOdometer");
    }

    const date = createServiceOrderSchema.safeParse({
      vehicleId: "veh-1",
      complaint: "Noise",
      odometerIn: "",
      requestedServices: "",
      expectedCompletion: "not-a-date",
      technicianId: "",
      bay: "",
      priority: "",
    });
    expect(date.success).toBe(false);
    if (!date.success) {
      expect(date.error.issues.map((issue) => issue.message)).toContain(
        "validation.invalidDate",
      );
    }

    const quantity = addServiceOrderLineSchema.safeParse({
      type: "LABOUR",
      description: "Labour",
      quantity: 0,
      unitPricePaise: "100",
      partId: "",
    });
    expect(quantity.success).toBe(false);
    if (!quantity.success) {
      expect(quantity.error.issues.map((issue) => issue.message)).toContain(
        "validation.invalidQuantity",
      );
    }
  });
});

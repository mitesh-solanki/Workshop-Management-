import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError, ForbiddenError } from "@/lib/errors";
import type { RoleSession } from "@/lib/rbac";
import { normaliseRegistration } from "@/modules/vehicles/schema";

vi.mock("@/modules/customers/repo", () => ({
  createCustomer: vi.fn(),
  findCustomerById: vi.fn(),
  searchCustomers: vi.fn(),
  updateCustomerById: vi.fn(),
}));

vi.mock("@/modules/vehicles/repo", () => ({
  createVehicle: vi.fn(),
  findVehicleById: vi.fn(),
  findVehicleByRegistration: vi.fn(),
  isUniqueConstraintError: vi.fn(() => false),
  updateVehicleById: vi.fn(),
}));

import {
  findCustomerById,
  searchCustomers,
  updateCustomerById,
} from "@/modules/customers/repo";
import {
  getCustomer,
  getCustomerForGarageId,
  listCustomers,
  updateCustomerForGarageId,
  updateCustomerRecord,
} from "@/modules/customers/service";
import {
  createVehicle,
  findVehicleById,
  findVehicleByRegistration,
} from "@/modules/vehicles/repo";
import {
  createVehicleForGarageId,
  createVehicleRecord,
  getVehicleForGarageId,
} from "@/modules/vehicles/service";

const garageA = "garage-a";
const garageB = "garage-b";

const ownerA: RoleSession = {
  userId: "user-a",
  garageId: garageA,
  role: "OWNER",
};

const ownerB: RoleSession = {
  userId: "user-b",
  garageId: garageB,
  role: "OWNER",
};

const sampleCustomer = {
  id: "cust-a",
  garageId: garageA,
  name: "Ravi Patel",
  phone: "9876543210",
  address: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  vehicles: [],
};

describe("normaliseRegistration", () => {
  it("uppercases and strips spaces", () => {
    expect(normaliseRegistration("gj 01 ab 1234")).toBe("GJ01AB1234");
    expect(normaliseRegistration("  MH-12-XY-99 ")).toBe("MH-12-XY-99");
  });
});

describe("duplicate registration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a second vehicle with the same registration in one garage", async () => {
    vi.mocked(findCustomerById).mockResolvedValue(sampleCustomer);
    vi.mocked(findVehicleByRegistration).mockResolvedValue({
      id: "veh-existing",
      garageId: garageA,
      customerId: "cust-a",
      registrationNumber: "GJ01AB1234",
      make: "Maruti",
      model: "Swift",
      year: 2020,
      odometer: 10000,
      insuranceExpiry: null,
      pucExpiry: null,
      fitnessExpiry: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      createVehicleRecord(ownerA, {
        customerId: "cust-a",
        registrationNumber: "gj 01 ab 1234",
        make: "Honda",
        model: "City",
        year: 2019,
        odometer: 5000,
        insuranceExpiry: null,
        pucExpiry: null,
        fitnessExpiry: null,
      }),
    ).rejects.toMatchObject({
      code: "DUPLICATE_REGISTRATION",
    } satisfies Partial<AppError>);

    expect(createVehicle).not.toHaveBeenCalled();
    expect(findVehicleByRegistration).toHaveBeenCalledWith(
      garageA,
      "GJ01AB1234",
    );
  });

  it("allows the same registration in a different garage", async () => {
    vi.mocked(findCustomerById).mockResolvedValue({
      ...sampleCustomer,
      id: "cust-b",
      garageId: garageB,
    });
    vi.mocked(findVehicleByRegistration).mockResolvedValue(null);
    vi.mocked(createVehicle).mockResolvedValue({
      id: "veh-b",
      garageId: garageB,
      customerId: "cust-b",
      registrationNumber: "GJ01AB1234",
      make: "Honda",
      model: "City",
      year: 2019,
      odometer: 5000,
      insuranceExpiry: null,
      pucExpiry: null,
      fitnessExpiry: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const vehicle = await createVehicleRecord(ownerB, {
      customerId: "cust-b",
      registrationNumber: "GJ 01 AB 1234",
      make: "Honda",
      model: "City",
      year: 2019,
      odometer: 5000,
      insuranceExpiry: null,
      pucExpiry: null,
      fitnessExpiry: null,
    });

    expect(findVehicleByRegistration).toHaveBeenCalledWith(
      garageB,
      "GJ01AB1234",
    );
    expect(createVehicle).toHaveBeenCalledWith(
      garageB,
      expect.objectContaining({
        registrationNumber: "GJ01AB1234",
        customerId: "cust-b",
      }),
    );
    expect(vehicle.garageId).toBe(garageB);
  });
});

describe("garageId filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists customers only for the session garage", async () => {
    vi.mocked(searchCustomers).mockResolvedValue([]);

    await listCustomers(ownerA, { q: "ravi" });

    expect(searchCustomers).toHaveBeenCalledWith(garageA, "ravi");
    expect(searchCustomers).not.toHaveBeenCalledWith(garageB, expect.anything());
  });

  it("loads a customer with the session garageId", async () => {
    vi.mocked(findCustomerById).mockResolvedValue(sampleCustomer);

    const customer = await getCustomer(ownerA, "cust-a");

    expect(findCustomerById).toHaveBeenCalledWith(garageA, "cust-a");
    expect(customer.garageId).toBe(garageA);
  });

  it("rejects reading a customer when another garageId is requested", async () => {
    await expect(
      getCustomerForGarageId(ownerA, garageB, "cust-a"),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(findCustomerById).not.toHaveBeenCalled();
  });

  it("updates only against the session garageId", async () => {
    vi.mocked(updateCustomerById).mockResolvedValue({
      ...sampleCustomer,
      name: "Ravi Updated",
    });

    await updateCustomerRecord(ownerA, "cust-a", {
      name: "Ravi Updated",
      phone: "9876543210",
      address: null,
      notes: null,
    });

    expect(updateCustomerById).toHaveBeenCalledWith(garageA, "cust-a", {
      name: "Ravi Updated",
      phone: "9876543210",
      address: null,
      notes: null,
    });
    expect(updateCustomerById).not.toHaveBeenCalledWith(
      garageB,
      expect.anything(),
      expect.anything(),
    );
  });

  it("rejects updating a customer for another garageId", async () => {
    await expect(
      updateCustomerForGarageId(ownerA, garageB, "cust-a", {
        name: "Hacked",
        phone: "111",
        address: null,
        notes: null,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(updateCustomerById).not.toHaveBeenCalled();
  });

  it("rejects reading a vehicle for another garageId", async () => {
    await expect(
      getVehicleForGarageId(ownerA, garageB, "veh-1"),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(findVehicleById).not.toHaveBeenCalled();
  });

  it("rejects creating a vehicle when another garageId is requested", async () => {
    await expect(
      createVehicleForGarageId(ownerA, garageB, {
        customerId: "cust-b",
        registrationNumber: "GJ01ZZ9999",
        make: "Tata",
        model: "Nexon",
        year: 2022,
        odometer: 1000,
        insuranceExpiry: null,
        pucExpiry: null,
        fitnessExpiry: null,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(createVehicle).not.toHaveBeenCalled();
  });
});

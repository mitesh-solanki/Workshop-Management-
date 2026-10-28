import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RoleSession } from "@/lib/rbac";
import {
  GLOBAL_SEARCH_ENTITY_TYPES,
  GLOBAL_SEARCH_MATCH_FIELDS,
  GLOBAL_SEARCH_MIN_CHARS,
  GLOBAL_SEARCH_PER_TYPE,
} from "@/modules/global-search/schema";

vi.mock("@/modules/global-search/repo", () => ({
  searchCustomersForGlobal: vi.fn(),
  searchVehiclesForGlobal: vi.fn(),
  searchOrdersForGlobal: vi.fn(),
  searchPartsForGlobal: vi.fn(),
  searchVendorsForGlobal: vi.fn(),
  searchInvoicesForGlobal: vi.fn(),
}));

import {
  searchCustomersForGlobal,
  searchInvoicesForGlobal,
  searchOrdersForGlobal,
  searchPartsForGlobal,
  searchVehiclesForGlobal,
  searchVendorsForGlobal,
} from "@/modules/global-search/repo";
import { runGlobalSearch } from "@/modules/global-search/service";

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

const technicianA: RoleSession = {
  userId: "tech-a",
  garageId: garageA,
  role: "TECHNICIAN",
};

const managerA: RoleSession = {
  userId: "mgr-a",
  garageId: garageA,
  role: "MANAGER",
};

function emptyMocks() {
  vi.mocked(searchCustomersForGlobal).mockResolvedValue([]);
  vi.mocked(searchVehiclesForGlobal).mockResolvedValue([]);
  vi.mocked(searchOrdersForGlobal).mockResolvedValue([]);
  vi.mocked(searchPartsForGlobal).mockResolvedValue([]);
  vi.mocked(searchVendorsForGlobal).mockResolvedValue([]);
  vi.mocked(searchInvoicesForGlobal).mockResolvedValue([]);
}

describe("global search schema", () => {
  it("keeps min chars and per-type limits stable", () => {
    expect(GLOBAL_SEARCH_MIN_CHARS).toBe(2);
    expect(GLOBAL_SEARCH_PER_TYPE).toBe(5);
  });

  it("lists every searchable entity type", () => {
    expect([...GLOBAL_SEARCH_ENTITY_TYPES]).toEqual([
      "customer",
      "vehicle",
      "order",
      "part",
      "vendor",
      "invoice",
    ]);
  });

  it("lists match field keys used by the UI", () => {
    expect([...GLOBAL_SEARCH_MATCH_FIELDS]).toEqual([
      "name",
      "phone",
      "registration",
      "make",
      "model",
      "complaint",
      "sku",
      "hsn",
      "gstin",
      "email",
      "invoiceNumber",
    ]);
  });
});

describe("runGlobalSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    emptyMocks();
  });

  it("returns empty for short or blank queries without hitting the repo", async () => {
    const short = "a".repeat(Math.max(0, GLOBAL_SEARCH_MIN_CHARS - 1));
    await expect(runGlobalSearch(ownerA, short)).resolves.toEqual([]);
    await expect(runGlobalSearch(ownerA, "  ")).resolves.toEqual([]);
    await expect(runGlobalSearch(ownerA, "")).resolves.toEqual([]);
    expect(searchCustomersForGlobal).not.toHaveBeenCalled();
    expect(searchVehiclesForGlobal).not.toHaveBeenCalled();
    expect(searchOrdersForGlobal).not.toHaveBeenCalled();
    expect(searchPartsForGlobal).not.toHaveBeenCalled();
    expect(searchVendorsForGlobal).not.toHaveBeenCalled();
    expect(searchInvoicesForGlobal).not.toHaveBeenCalled();
  });

  it("trims the query before searching", async () => {
    await runGlobalSearch(ownerA, "  Ravi  ");
    expect(searchCustomersForGlobal).toHaveBeenCalledWith(garageA, "Ravi");
  });

  it("searches only the session garageId", async () => {
    vi.mocked(searchCustomersForGlobal).mockResolvedValue([
      { id: "cust-a", name: "Ravi Patel", phone: "9876543210" },
    ]);

    const results = await runGlobalSearch(ownerA, "Ravi");

    expect(searchCustomersForGlobal).toHaveBeenCalledWith(garageA, "Ravi");
    expect(searchVehiclesForGlobal).toHaveBeenCalledWith(garageA, "Ravi");
    expect(searchOrdersForGlobal).toHaveBeenCalledWith(garageA, "Ravi", {});
    expect(searchPartsForGlobal).toHaveBeenCalledWith(garageA, "Ravi");
    expect(searchVendorsForGlobal).toHaveBeenCalledWith(garageA, "Ravi");
    expect(searchInvoicesForGlobal).toHaveBeenCalledWith(garageA, "Ravi");
    expect(results).toEqual([
      expect.objectContaining({
        id: "cust-a",
        type: "customer",
        title: "Ravi Patel",
        subtitle: "9876543210",
        href: "/customers/cust-a",
        matchIn: "name",
      }),
    ]);

    await runGlobalSearch(ownerB, "Ravi");
    expect(searchCustomersForGlobal).toHaveBeenLastCalledWith(garageB, "Ravi");
  });

  it("scopes job-card search to the technician session user", async () => {
    await runGlobalSearch(technicianA, "brake");
    expect(searchOrdersForGlobal).toHaveBeenCalledWith(garageA, "brake", {
      technicianId: "tech-a",
    });
    expect(searchPartsForGlobal).not.toHaveBeenCalled();
    expect(searchVendorsForGlobal).not.toHaveBeenCalled();
    expect(searchInvoicesForGlobal).not.toHaveBeenCalled();
  });

  it("does not scope job cards for manager or owner", async () => {
    await runGlobalSearch(managerA, "brake");
    expect(searchOrdersForGlobal).toHaveBeenCalledWith(garageA, "brake", {});
    await runGlobalSearch(ownerA, "brake");
    expect(searchOrdersForGlobal).toHaveBeenLastCalledWith(garageA, "brake", {});
  });

  it("maps customer phone matches", async () => {
    vi.mocked(searchCustomersForGlobal).mockResolvedValue([
      { id: "cust-a", name: "Ravi Patel", phone: "9876543210" },
    ]);

    const results = await runGlobalSearch(ownerA, "98765");
    expect(results[0]).toMatchObject({
      type: "customer",
      matchIn: "phone",
      href: "/customers/cust-a",
    });
  });

  it("maps vehicles with registration spacing normalised for matchIn", async () => {
    vi.mocked(searchVehiclesForGlobal).mockResolvedValue([
      {
        id: "veh-a",
        registrationNumber: "GJ01AB1234",
        make: "Honda",
        model: "City",
        customer: { name: "Ravi Patel", phone: "9876543210" },
      },
    ]);

    const results = await runGlobalSearch(ownerA, "gj 01 ab");
    expect(results[0]).toMatchObject({
      type: "vehicle",
      title: "GJ01AB1234",
      subtitle: "Honda City · Ravi Patel",
      href: "/vehicles/veh-a",
      matchIn: "registration",
    });
  });

  it("maps vehicle make matches", async () => {
    vi.mocked(searchVehiclesForGlobal).mockResolvedValue([
      {
        id: "veh-a",
        registrationNumber: "GJ01AB1234",
        make: "Honda",
        model: "City",
        customer: { name: "Ravi Patel", phone: "9876543210" },
      },
    ]);

    const results = await runGlobalSearch(ownerA, "honda");
    expect(results[0]).toMatchObject({
      type: "vehicle",
      matchIn: "make",
    });
  });

  it("maps job cards to /orders/[id]", async () => {
    vi.mocked(searchOrdersForGlobal).mockResolvedValue([
      {
        id: "order-1",
        complaint: "Brake noise",
        status: "IN_PROGRESS",
        customer: { name: "Ravi Patel", phone: "9876543210" },
        vehicle: {
          registrationNumber: "GJ01AB1234",
          make: "Honda",
          model: "City",
        },
      },
    ]);

    const results = await runGlobalSearch(ownerA, "Brake");
    expect(results[0]).toMatchObject({
      type: "order",
      title: "GJ01AB1234",
      subtitle: "Ravi Patel · Brake noise",
      href: "/orders/order-1",
      matchIn: "complaint",
    });
  });

  it("maps parts to inventory detail by sku and hsn", async () => {
    vi.mocked(searchPartsForGlobal).mockResolvedValue([
      {
        id: "part-1",
        name: "Oil filter",
        sku: "OF-100",
        hsn: "8421",
      },
    ]);

    const bySku = await runGlobalSearch(ownerA, "OF-100");
    expect(bySku[0]).toMatchObject({
      type: "part",
      title: "Oil filter",
      subtitle: "OF-100",
      href: "/inventory/part-1",
      matchIn: "sku",
    });

    emptyMocks();
    vi.mocked(searchPartsForGlobal).mockResolvedValue([
      {
        id: "part-1",
        name: "Oil filter",
        sku: "OF-100",
        hsn: "8421",
      },
    ]);
    const byHsn = await runGlobalSearch(ownerA, "8421");
    expect(byHsn[0]).toMatchObject({ matchIn: "hsn" });
  });

  it("maps vendors with subtitle fallbacks", async () => {
    vi.mocked(searchVendorsForGlobal).mockResolvedValue([
      {
        id: "ven-1",
        name: "Auto Parts Co",
        phone: null,
        gstin: "24AAAAA0000A1Z5",
        email: "sales@example.com",
      },
    ]);

    const results = await runGlobalSearch(ownerA, "24AAAAA");
    expect(results[0]).toMatchObject({
      type: "vendor",
      title: "Auto Parts Co",
      subtitle: "24AAAAA0000A1Z5",
      href: "/vendors/ven-1",
      matchIn: "gstin",
    });
  });

  it("maps invoice results to the job-card billing section", async () => {
    vi.mocked(searchInvoicesForGlobal).mockResolvedValue([
      {
        id: "inv-1",
        invoiceNumber: "INV/2025-26/0001",
        serviceOrderId: "order-1",
        customer: { name: "Ravi Patel", phone: "9876543210" },
        serviceOrder: {
          vehicle: { registrationNumber: "GJ01AB1234" },
        },
      },
    ]);

    const results = await runGlobalSearch(ownerA, "INV/2025");
    expect(results[0]).toMatchObject({
      type: "invoice",
      title: "INV/2025-26/0001",
      subtitle: "Ravi Patel · GJ01AB1234",
      href: "/orders/order-1?section=billing",
      matchIn: "invoiceNumber",
    });
  });

  it("uses invoice id as title when invoiceNumber is null", async () => {
    vi.mocked(searchInvoicesForGlobal).mockResolvedValue([
      {
        id: "inv-draft",
        invoiceNumber: null,
        serviceOrderId: "order-2",
        customer: { name: "Meera Shah", phone: "9123456780" },
        serviceOrder: {
          vehicle: { registrationNumber: "GJ05CD9999" },
        },
      },
    ]);

    const results = await runGlobalSearch(ownerA, "Meera");
    expect(results[0]).toMatchObject({
      type: "invoice",
      title: "inv-draft",
      matchIn: "name",
      href: "/orders/order-2?section=billing",
    });
  });

  it("merges all entity types into one result list in stable order", async () => {
    vi.mocked(searchCustomersForGlobal).mockResolvedValue([
      { id: "c1", name: "Ravi", phone: "111" },
    ]);
    vi.mocked(searchVehiclesForGlobal).mockResolvedValue([
      {
        id: "v1",
        registrationNumber: "GJ01AA0001",
        make: "Tata",
        model: "Nexon",
        customer: { name: "Ravi", phone: "111" },
      },
    ]);
    vi.mocked(searchOrdersForGlobal).mockResolvedValue([
      {
        id: "o1",
        complaint: "Rattle",
        status: "WAITING",
        customer: { name: "Ravi", phone: "111" },
        vehicle: {
          registrationNumber: "GJ01AA0001",
          make: "Tata",
          model: "Nexon",
        },
      },
    ]);
    vi.mocked(searchPartsForGlobal).mockResolvedValue([
      { id: "p1", name: "Pad", sku: "PAD-1", hsn: "8708" },
    ]);
    vi.mocked(searchVendorsForGlobal).mockResolvedValue([
      {
        id: "vn1",
        name: "Vendor One",
        phone: "222",
        gstin: null,
        email: null,
      },
    ]);
    vi.mocked(searchInvoicesForGlobal).mockResolvedValue([
      {
        id: "i1",
        invoiceNumber: "INV/1",
        serviceOrderId: "o1",
        customer: { name: "Ravi", phone: "111" },
        serviceOrder: { vehicle: { registrationNumber: "GJ01AA0001" } },
      },
    ]);

    const results = await runGlobalSearch(ownerA, "aa");
    expect(results.map((r) => r.type)).toEqual([
      "customer",
      "vehicle",
      "order",
      "part",
      "vendor",
      "invoice",
    ]);
  });
});

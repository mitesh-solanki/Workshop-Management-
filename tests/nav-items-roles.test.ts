import { describe, expect, it } from "vitest";
import {
  navItemsForRole,
  type AppRole,
  type NavKey,
} from "@/components/shared/nav-items";

function keysFor(role: AppRole): NavKey[] {
  return navItemsForRole(role).flatMap((item) => [
    item.key,
    ...(item.children?.map((child) => child.key) ?? []),
  ]);
}

describe("navItemsForRole — other roles keep full access", () => {
  it("keeps owner workshop, money, stock and admin entries", () => {
    expect(keysFor("OWNER")).toEqual(
      expect.arrayContaining([
        "dashboard",
        "workshop",
        "orders",
        "jobSlips",
        "inspections",
        "bays",
        "customers",
        "vehicles",
        "invoices",
        "reports",
        "inventory",
        "counterSales",
        "vendors",
        "purchaseOrders",
        "vendorBills",
        "purchaseReturns",
        "expenses",
        "team",
        "settings",
      ]),
    );
  });

  it("keeps manager the same business surface as owner except payroll", () => {
    const owner = keysFor("OWNER");
    const manager = keysFor("MANAGER");
    expect(manager).toEqual(expect.arrayContaining(["expenses"]));
    expect(manager).not.toContain("payroll");
    expect(owner).toEqual(expect.arrayContaining(["expenses", "payroll"]));
    expect(manager.filter((key) => key !== "payroll")).toEqual(
      owner.filter((key) => !key.startsWith("payroll")),
    );
  });

  it("keeps accountant money and inventory (not purchases ops or settings)", () => {
    const keys = keysFor("ACCOUNTANT");
    expect(keys).toEqual(
      expect.arrayContaining([
        "dashboard",
        "workshop",
        "orders",
        "jobSlips",
        "inspections",
        "customers",
        "vehicles",
        "invoices",
        "reports",
        "inventory",
        "counterSales",
        "vendors",
        "vendorBills",
        "purchaseReturns",
        "expenses",
        "team",
        "payroll",
      ]),
    );
    expect(keys).not.toContain("bays");
    expect(keys).not.toContain("partsRequests");
    expect(keys).not.toContain("purchaseOrders");
    expect(keys).not.toContain("settings");
  });

  it("limits technician to workshop board and job cards", () => {
    expect(keysFor("TECHNICIAN")).toEqual(["workshop", "orders"]);
  });
});

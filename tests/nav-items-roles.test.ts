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
        "inspections",
        "bays",
        "customers",
        "vehicles",
        "invoices",
        "inventory",
        "counterSales",
        "vendors",
        "partsRequests",
        "purchaseOrders",
        "vendorBills",
        "purchaseReturns",
        "team",
        "settings",
      ]),
    );
  });

  it("keeps manager the same business surface as owner", () => {
    expect(keysFor("MANAGER")).toEqual(keysFor("OWNER"));
  });

  it("keeps accountant money and inventory (not team or purchases ops)", () => {
    const keys = keysFor("ACCOUNTANT");
    expect(keys).toEqual(
      expect.arrayContaining([
        "dashboard",
        "workshop",
        "orders",
        "inspections",
        "customers",
        "vehicles",
        "invoices",
        "inventory",
        "counterSales",
        "vendors",
        "vendorBills",
        "purchaseReturns",
      ]),
    );
    expect(keys).not.toContain("bays");
    expect(keys).not.toContain("partsRequests");
    expect(keys).not.toContain("purchaseOrders");
    expect(keys).not.toContain("team");
    expect(keys).not.toContain("settings");
  });

  it("limits technician to workshop board and job cards", () => {
    expect(keysFor("TECHNICIAN")).toEqual(["workshop", "orders"]);
  });
});

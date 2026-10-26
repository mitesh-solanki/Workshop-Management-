import { describe, expect, it, vi } from "vitest";
import { ForbiddenError } from "@/lib/errors";
import type { RoleSession } from "@/lib/rbac";

vi.mock("server-only", () => ({}));

function session(role: RoleSession["role"]): RoleSession {
  return { userId: "u1", garageId: "g1", role };
}

describe("purchases role limits", () => {
  it("technician cannot access purchase ops or vendor money", async () => {
    const {
      assertCanAccessPurchaseOps,
      assertCanAccessVendorMoney,
    } = await import("@/modules/purchases/service");
    const { assertCanAccessVendors } = await import(
      "@/modules/vendors/service"
    );

    expect(() => assertCanAccessPurchaseOps(session("TECHNICIAN"))).toThrow(
      ForbiddenError,
    );
    expect(() => assertCanAccessVendorMoney(session("TECHNICIAN"))).toThrow(
      ForbiddenError,
    );
    expect(() => assertCanAccessVendors(session("TECHNICIAN"))).toThrow(
      ForbiddenError,
    );
  });

  it("accountant can access vendor money and vendors, not purchase ops", async () => {
    const {
      assertCanAccessPurchaseOps,
      assertCanAccessVendorMoney,
      canWriteVendorMoney,
      canWritePurchaseOps,
    } = await import("@/modules/purchases/service");
    const { assertCanAccessVendors, canWriteVendors } = await import(
      "@/modules/vendors/service"
    );

    expect(() => assertCanAccessVendorMoney(session("ACCOUNTANT"))).not.toThrow();
    expect(() => assertCanAccessVendors(session("ACCOUNTANT"))).not.toThrow();
    expect(canWriteVendorMoney(session("ACCOUNTANT"))).toBe(true);
    expect(canWriteVendors(session("ACCOUNTANT"))).toBe(false);
    expect(() => assertCanAccessPurchaseOps(session("ACCOUNTANT"))).toThrow(
      ForbiddenError,
    );
    expect(canWritePurchaseOps(session("ACCOUNTANT"))).toBe(false);
  });

  it("owner and manager can access all purchase surfaces", async () => {
    const {
      assertCanAccessPurchaseOps,
      assertCanAccessVendorMoney,
      canWritePurchaseOps,
      canWriteVendorMoney,
    } = await import("@/modules/purchases/service");
    const { assertCanAccessVendors, canWriteVendors } = await import(
      "@/modules/vendors/service"
    );

    for (const role of ["OWNER", "MANAGER"] as const) {
      expect(() => assertCanAccessPurchaseOps(session(role))).not.toThrow();
      expect(() => assertCanAccessVendorMoney(session(role))).not.toThrow();
      expect(() => assertCanAccessVendors(session(role))).not.toThrow();
      expect(canWritePurchaseOps(session(role))).toBe(true);
      expect(canWriteVendorMoney(session(role))).toBe(true);
      expect(canWriteVendors(session(role))).toBe(true);
    }
  });
});

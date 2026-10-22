import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors";

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(),
}));

import { getTranslations } from "next-intl/server";
import { translateError } from "@/lib/translate-error";

describe("translateError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTranslations).mockImplementation((async (namespace?: string) => {
      const ns = typeof namespace === "string" ? namespace : "common";
      return (key: string) => `${ns}.${key}`;
    }) as typeof getTranslations);
  });

  it("maps CUSTOMER_HAS_ORDERS and VEHICLE_HAS_ORDERS to locale keys", async () => {
    await expect(
      translateError(new AppError("CUSTOMER_HAS_ORDERS")),
    ).resolves.toBe("customers.cannotDeleteHasOrders");

    await expect(
      translateError(new AppError("VEHICLE_HAS_ORDERS")),
    ).resolves.toBe("vehicles.cannotDeleteHasOrders");
  });

  it("maps service-order AppError codes to orders.errors keys", async () => {
    await expect(
      translateError(new AppError("INVALID_STATUS_TRANSITION")),
    ).resolves.toBe("orders.errors.invalidStatusTransition");

    await expect(
      translateError(new AppError("INVALID_TECHNICIAN")),
    ).resolves.toBe("orders.errors.invalidTechnician");

    await expect(translateError(new AppError("ORDER_COMPLETED"))).resolves.toBe(
      "orders.errors.orderCompleted",
    );

    await expect(translateError(new AppError("STATUS_CONFLICT"))).resolves.toBe(
      "orders.errors.statusConflict",
    );
  });

  it("translates Zod validation.* message keys under errors", async () => {
    const error = new ZodError([
      {
        code: "custom",
        path: ["odometerIn"],
        message: "validation.invalidOdometer",
      },
    ]);

    await expect(translateError(error)).resolves.toBe(
      "errors.validation.invalidOdometer",
    );
  });
});

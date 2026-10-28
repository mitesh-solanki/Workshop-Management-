import { describe, expect, it } from "vitest";
import {
  createVehicleSchema,
  getVehicleYearMax,
  isValidVehicleOdometerInput,
  isValidVehicleYearInput,
  sanitizeOdometerTyping,
  sanitizeYearTyping,
  VEHICLE_ODOMETER_MAX,
  VEHICLE_YEAR_MIN,
} from "@/modules/vehicles/schema";

describe("vehicle year and odometer input", () => {
  it("limits year typing to 4 digits", () => {
    expect(sanitizeYearTyping("4546565656565656")).toBe("4546");
    expect(sanitizeYearTyping("20ab24")).toBe("2024");
  });

  it("limits odometer typing to 6 digits", () => {
    expect(sanitizeOdometerTyping("1234567890")).toBe("123456");
    expect(sanitizeOdometerTyping("12km345")).toBe("12345");
    expect(sanitizeOdometerTyping("9999999")).toBe("999999");
  });

  it("accepts empty or valid year/odometer", () => {
    const yearMax = getVehicleYearMax();
    expect(isValidVehicleYearInput("")).toBe(true);
    expect(isValidVehicleYearInput("2020")).toBe(true);
    expect(isValidVehicleYearInput("1949")).toBe(false);
    expect(isValidVehicleYearInput(String(yearMax))).toBe(true);
    expect(isValidVehicleYearInput(String(yearMax + 1))).toBe(false);
    expect(isValidVehicleYearInput("202")).toBe(false);

    expect(isValidVehicleOdometerInput("")).toBe(true);
    expect(isValidVehicleOdometerInput("0")).toBe(true);
    expect(isValidVehicleOdometerInput(String(VEHICLE_ODOMETER_MAX))).toBe(
      true,
    );
    expect(isValidVehicleOdometerInput("1000000")).toBe(false);
  });

  it("rejects absurd year and km through createVehicleSchema", () => {
    expect(
      createVehicleSchema.safeParse({
        customerId: "c1",
        registrationNumber: "GJ01AB1234",
        make: "Honda",
        model: "City",
        stateCode: "24",
        year: "4546565656565656",
        odometer: "",
      }).success,
    ).toBe(false);

    expect(
      createVehicleSchema.safeParse({
        customerId: "c1",
        registrationNumber: "GJ01AB1234",
        make: "Honda",
        model: "City",
        stateCode: "24",
        year: String(VEHICLE_YEAR_MIN),
        odometer: "9999999",
      }).success,
    ).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  filterCommonVehicleMakes,
  filterCommonVehicleModels,
} from "@/modules/vehicles/common-vehicle-names";

describe("filterCommonVehicleMakes", () => {
  it("prefers starts-with matches", () => {
    expect(filterCommonVehicleMakes("mar")).toContain("Maruti Suzuki");
  });

  it("returns empty for blank query", () => {
    expect(filterCommonVehicleMakes("")).toEqual([]);
    expect(filterCommonVehicleMakes("   ")).toEqual([]);
  });
});

describe("filterCommonVehicleModels", () => {
  it("limits to the selected make when known", () => {
    const models = filterCommonVehicleModels("s", "Maruti Suzuki", 20);
    expect(models).toContain("Swift");
    expect(models).not.toContain("Sonet");
  });

  it("searches all models when make is unknown", () => {
    const models = filterCommonVehicleModels("cre", "Custom Garage Build");
    expect(models).toContain("Creta");
  });

  it("is case-insensitive on make", () => {
    expect(filterCommonVehicleModels("swi", "maruti suzuki")).toContain("Swift");
  });
});

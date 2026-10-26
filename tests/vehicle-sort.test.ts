import { describe, expect, it } from "vitest";
import { vehicleSearchSchema } from "@/modules/vehicles/schema";

describe("vehicle list sort", () => {
  it("defaults to A–Z (registration)", () => {
    expect(vehicleSearchSchema.parse({}).sort).toBe("name_asc");
  });

  it("accepts last added, last modified, and Z–A", () => {
    expect(vehicleSearchSchema.parse({ sort: "newest" }).sort).toBe("newest");
    expect(vehicleSearchSchema.parse({ sort: "updated" }).sort).toBe("updated");
    expect(vehicleSearchSchema.parse({ sort: "name_desc" }).sort).toBe(
      "name_desc",
    );
  });
});

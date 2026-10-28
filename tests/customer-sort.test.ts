import { describe, expect, it } from "vitest";
import { customerSearchSchema } from "@/modules/customers/schema";

describe("customer list sort", () => {
  it("defaults to newest (last added first)", () => {
    const parsed = customerSearchSchema.parse({});
    expect(parsed.sort).toBe("newest");
  });

  it("accepts oldest, last modified, A–Z and Z–A", () => {
    expect(customerSearchSchema.parse({ sort: "oldest" }).sort).toBe("oldest");
    expect(customerSearchSchema.parse({ sort: "updated" }).sort).toBe(
      "updated",
    );
    expect(customerSearchSchema.parse({ sort: "name_asc" }).sort).toBe(
      "name_asc",
    );
    expect(customerSearchSchema.parse({ sort: "name_desc" }).sort).toBe(
      "name_desc",
    );
  });
});

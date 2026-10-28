import { describe, expect, it } from "vitest";
import { partSearchSchema } from "@/modules/inventory/schema";

describe("inventory list sort", () => {
  it("defaults to A–Z (name)", () => {
    expect(partSearchSchema.parse({}).sort).toBe("newest");
  });

  it("accepts last added, oldest, last modified, and Z–A", () => {
    expect(partSearchSchema.parse({ sort: "newest" }).sort).toBe("newest");
    expect(partSearchSchema.parse({ sort: "oldest" }).sort).toBe("oldest");
    expect(partSearchSchema.parse({ sort: "updated" }).sort).toBe("updated");
    expect(partSearchSchema.parse({ sort: "name_desc" }).sort).toBe(
      "name_desc",
    );
  });
});

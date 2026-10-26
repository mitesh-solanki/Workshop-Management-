import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("technician request part gate", () => {
  it("limits canRequestParts to owner and manager on job cards", () => {
    const page = readFileSync(
      join(process.cwd(), "src/app/(app)/orders/[id]/page.tsx"),
      "utf8",
    );
    const panel = readFileSync(
      join(
        process.cwd(),
        "src/modules/service-orders/components/job-card-detail-panel.tsx",
      ),
      "utf8",
    );

    expect(page).toMatch(
      /canRequestParts\s*=\s*\n?\s*\(session\.role === "OWNER" \|\| session\.role === "MANAGER"\)/,
    );
    expect(panel).toMatch(/canRequestParts=\{canRequestParts\}/);
    expect(panel).not.toMatch(/canRequestParts=\{canMutate\}/);
  });
});

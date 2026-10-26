import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const purchasesRepo = readFileSync(
  join(process.cwd(), "src/modules/purchases/repo.ts"),
  "utf8",
);
const vendorsRepo = readFileSync(
  join(process.cwd(), "src/modules/vendors/repo.ts"),
  "utf8",
);

describe("garageId on purchase and vendor updates", () => {
  it("scopes cancel, receive, bill attachment and vendor update by garageId", () => {
    expect(purchasesRepo).toMatch(
      /partsRequest\.updateMany\(\s*\{[\s\S]*?where:\s*\{\s*id:\s*requestId,\s*garageId/,
    );
    expect(purchasesRepo).toMatch(
      /purchaseOrderLine\.updateMany\(\s*\{[\s\S]*?where:\s*\{\s*id:\s*poLine\.id,\s*garageId/,
    );
    expect(purchasesRepo).toMatch(
      /purchaseOrder\.updateMany\(\s*\{[\s\S]*?where:\s*\{\s*id:\s*po\.id,\s*garageId/,
    );
    expect(purchasesRepo).toMatch(
      /vendorBill\.updateMany\(\s*\{[\s\S]*?where:\s*\{\s*id:\s*existing\.id,\s*garageId/,
    );
    expect(vendorsRepo).toMatch(
      /vendor\.updateMany\(\s*\{[\s\S]*?where:\s*\{\s*id:\s*vendorId,\s*garageId/,
    );

    expect(purchasesRepo).not.toMatch(
      /partsRequest\.update\(\s*\{\s*where:\s*\{\s*id:\s*requestId\s*\}/,
    );
    expect(vendorsRepo).not.toMatch(
      /vendor\.update\(\s*\{\s*where:\s*\{\s*id:\s*vendorId\s*\}/,
    );
  });
});

import { describe, expect, it } from "vitest";
import {
  displayShopReceiveNote,
  parseShopReceiveBillId,
  parseShopReceiveLines,
  shopReceiveFilesForUpload,
  shopReceiveRequiredVendorErrorKeys,
  withShopReceiveBillId,
} from "@/modules/inventory/shop-receive";

function formWithShopLines(
  rows: Array<{ vendorId?: string; qty?: string }>,
): FormData {
  const formData = new FormData();
  formData.set("shopLineCount", String(rows.length));
  rows.forEach((row, index) => {
    formData.set(`shopVendorId_${index}`, row.vendorId ?? "");
    formData.set(`shopQty_${index}`, row.qty ?? "1");
  });
  return formData;
}

describe("parseShopReceiveLines", () => {
  it("skips blank vendor rows so inventory can save with one filled vendor", () => {
    const lines = parseShopReceiveLines(
      formWithShopLines([
        { vendorId: "v1", qty: "2" },
        { vendorId: "", qty: "1" },
        { vendorId: "  ", qty: "1" },
        { vendorId: "v2", qty: "3" },
      ]),
    );
    expect(lines).toEqual([
      { vendorId: "v1", quantity: 2 },
      { vendorId: "v2", quantity: 3 },
    ]);
  });

  it("returns empty when every row has no vendor (inventory optional)", () => {
    expect(
      parseShopReceiveLines(
        formWithShopLines([
          { vendorId: "", qty: "1" },
          { vendorId: "", qty: "5" },
        ]),
      ),
    ).toEqual([]);
  });

  it("returns empty when shopLineCount is missing", () => {
    expect(parseShopReceiveLines(new FormData())).toEqual([]);
  });

  it("reads the qty the user set so stock-in matches Qty From Vendor", () => {
    expect(
      parseShopReceiveLines(
        formWithShopLines([{ vendorId: "v1", qty: "3" }]),
      ),
    ).toEqual([{ vendorId: "v1", quantity: 3 }]);
  });

  it("uses the first shopQty when duplicates exist (mobile+desktop must not both submit)", () => {
    const formData = new FormData();
    formData.set("shopLineCount", "1");
    formData.set("shopVendorId_0", "v1");
    formData.append("shopQty_0", "1");
    formData.append("shopQty_0", "3");
    expect(formData.get("shopQty_0")).toBe("1");
    expect(parseShopReceiveLines(formData)).toEqual([
      { vendorId: "v1", quantity: 1 },
    ]);
  });
});

describe("shopReceiveRequiredVendorErrorKeys (job-card part create)", () => {
  it("errors only the first row when no vendor is assigned", () => {
    expect(
      shopReceiveRequiredVendorErrorKeys([
        { key: "a", vendorId: "", quantity: 1 },
        { key: "b", vendorId: "", quantity: 1 },
      ]),
    ).toEqual(["a"]);
  });

  it("does not error blank extra rows when at least one vendor is set", () => {
    expect(
      shopReceiveRequiredVendorErrorKeys([
        { key: "a", vendorId: "v1", quantity: 1 },
        { key: "b", vendorId: "", quantity: 1 },
        { key: "c", vendorId: "  ", quantity: 1 },
      ]),
    ).toEqual([]);
  });

  it("flags filled rows with invalid quantity", () => {
    expect(
      shopReceiveRequiredVendorErrorKeys([
        { key: "a", vendorId: "v1", quantity: 0 },
        { key: "b", vendorId: "", quantity: 1 },
      ]),
    ).toEqual(["a"]);
  });
});

describe("shopReceiveFilesForUpload", () => {
  it("keeps file order aligned to filled vendor lines only", () => {
    const fileA = new File(["a"], "a.pdf", { type: "application/pdf" });
    const fileC = new File(["c"], "c.pdf", { type: "application/pdf" });
    expect(
      shopReceiveFilesForUpload([
        { key: "1", vendorId: "v1", quantity: 1, file: fileA },
        { key: "2", vendorId: "", quantity: 1, file: fileC },
        { key: "3", vendorId: "v3", quantity: 2, file: null },
      ]),
    ).toEqual([fileA, null]);
  });
});

describe("shop receive bill id marker", () => {
  it("embeds and parses vendor bill id without changing the visible note", () => {
    const note = withShopReceiveBillId("Auto Parts Hub", "bill_1");
    expect(parseShopReceiveBillId(note)).toBe("bill_1");
    expect(displayShopReceiveNote(note)).toBe("Auto Parts Hub");
  });

  it("strips legacy Bought from prefix for display", () => {
    expect(parseShopReceiveBillId("Bought from Auto Parts Hub")).toBeNull();
    expect(displayShopReceiveNote("Bought from Auto Parts Hub")).toBe(
      "Auto Parts Hub",
    );
  });
});

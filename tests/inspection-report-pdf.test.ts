import { describe, expect, it } from "vitest";
import {
  formatInspectionPdfExpectedCompletion,
  formatInspectionPdfMoney,
} from "@/modules/inspections/report-pdf";
import { saveInspectionItemsJsonSchema } from "@/modules/inspections/schema";

describe("inspection report PDF money", () => {
  it("formats paise as rupees (not 100x)", () => {
    expect(formatInspectionPdfMoney(24_400)).toBe("Rs. 244.00");
    expect(formatInspectionPdfMoney(40_000)).toBe("Rs. 400.00");
    expect(formatInspectionPdfMoney(64_400)).toBe("Rs. 644.00");
  });
});

describe("inspection report PDF expected completion", () => {
  it("formats a datetime for the PDF header", () => {
    const text = formatInspectionPdfExpectedCompletion(
      new Date(2026, 10, 2, 15, 30),
    );
    expect(text).toBe("2 Nov 2026, 3:30 pm");
    expect(formatInspectionPdfExpectedCompletion(null)).toBeNull();
    expect(formatInspectionPdfExpectedCompletion("")).toBeNull();
  });
});

describe("inspection note line price save", () => {
  it("converts rupee strings to paise once", () => {
    const items = saveInspectionItemsJsonSchema.parse(
      JSON.stringify([
        {
          id: null,
          label: "Brakes",
          result: "NEEDS_ATTENTION",
          externalCheck: false,
          lines: [
            { note: "dsdsdd", quantity: 1, unitPriceRupees: "244" },
            { note: "Differential Oil", quantity: 1, unitPriceRupees: "400" },
          ],
        },
      ]),
    );
    expect(items[0]?.unitPricePaise).toBe(64_400);
    const notes = JSON.parse(items[0]?.notes ?? "[]") as Array<{
      unitPricePaise: number;
    }>;
    expect(notes.map((line) => line.unitPricePaise)).toEqual([24_400, 40_000]);
  });

  it("does not convert numeric paise a second time", () => {
    const items = saveInspectionItemsJsonSchema.parse(
      JSON.stringify([
        {
          id: null,
          label: "Brakes",
          result: "",
          externalCheck: false,
          lines: [
            { note: "Pad", quantity: 1, unitPricePaise: 24_400 },
          ],
        },
      ]),
    );
    const notes = JSON.parse(items[0]?.notes ?? "[]") as Array<{
      unitPricePaise: number;
    }>;
    expect(notes[0]?.unitPricePaise).toBe(24_400);
    expect(items[0]?.unitPricePaise).toBe(24_400);
  });
});

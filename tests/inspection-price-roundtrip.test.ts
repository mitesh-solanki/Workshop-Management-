import { describe, expect, it } from "vitest";
import { formatRupees, paiseToRupeesInput } from "@/lib/money";
import { formatInspectionPdfMoney } from "@/modules/inspections/report-pdf";
import { saveInspectionItemsJsonSchema } from "@/modules/inspections/schema";
import { parseInspectionSubSpares } from "@/modules/inspections/sub-spares";

function saveLines(payload: unknown) {
  return saveInspectionItemsJsonSchema.parse(JSON.stringify(payload));
}

function formValueFromStoredNotes(notes: string | null, unitPricePaise: number) {
  const lines = parseInspectionSubSpares(notes, 1, unitPricePaise);
  return lines.map((line) => paiseToRupeesInput(line.unitPricePaise));
}

describe("inspection finding price round-trip", () => {
  it("stores ₹123 as 12300 paise — not 1230000", () => {
    const saved = saveLines([
      {
        id: null,
        label: "Brakes",
        result: "NEEDS_ATTENTION",
        externalCheck: false,
        lines: [{ note: "Brake Pad", quantity: 1, unitPriceRupees: "123" }],
      },
    ]);

    expect(saved[0]?.unitPricePaise).toBe(12_300);
    const notes = JSON.parse(saved[0]?.notes ?? "[]") as Array<{
      unitPricePaise: number;
    }>;
    expect(notes[0]?.unitPricePaise).toBe(12_300);
    expect(formatRupees(notes[0]!.unitPricePaise)).toContain("123.00");
    expect(formatInspectionPdfMoney(notes[0]!.unitPricePaise)).toBe(
      "Rs. 123.00",
    );
  });

  it("reopens ₹123 as form value 123 — not 12300", () => {
    const notes = JSON.stringify([
      { note: "Brake Pad", quantity: 1, unitPricePaise: 12_300 },
    ]);
    expect(formValueFromStoredNotes(notes, 12_300)).toEqual(["123"]);
  });

  it("save → reload → save again does not multiply by 100", () => {
    const first = saveLines([
      {
        id: null,
        label: "Brakes",
        result: "",
        externalCheck: false,
        lines: [{ note: "Brake Pad", quantity: 1, unitPriceRupees: "123" }],
      },
    ]);

    const reopened = formValueFromStoredNotes(
      first[0]!.notes,
      first[0]!.unitPricePaise,
    );
    expect(reopened).toEqual(["123"]);

    const second = saveLines([
      {
        id: "item-1",
        label: "Brakes",
        result: "",
        externalCheck: false,
        lines: reopened.map((unitPriceRupees) => ({
          note: "Brake Pad",
          quantity: 1,
          unitPriceRupees,
        })),
      },
    ]);

    expect(second[0]?.unitPricePaise).toBe(12_300);
    const notes = JSON.parse(second[0]?.notes ?? "[]") as Array<{
      unitPricePaise: number;
    }>;
    expect(notes[0]?.unitPricePaise).toBe(12_300);
  });

  it("does not treat numeric paise as rupees on save", () => {
    const saved = saveLines([
      {
        id: null,
        label: "Brakes",
        result: "",
        externalCheck: false,
        lines: [{ note: "Brake Pad", quantity: 1, unitPricePaise: 12_300 }],
      },
    ]);
    expect(saved[0]?.unitPricePaise).toBe(12_300);
  });

  it("documents the corrupted 123 → 12300.00 bug vs correct value", () => {
    const corruptedPaise = 1_230_000;
    expect(paiseToRupeesInput(corruptedPaise)).toBe("12300");
    expect(formatInspectionPdfMoney(corruptedPaise)).toBe("Rs. 12,300.00");

    const correctPaise = 12_300;
    expect(paiseToRupeesInput(correctPaise)).toBe("123");
    expect(formatInspectionPdfMoney(correctPaise)).toBe("Rs. 123.00");
  });
});

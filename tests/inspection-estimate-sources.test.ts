import { describe, expect, it } from "vitest";
import {
  collectInspectionEstimateSources,
  diffInspectionEstimateSources,
} from "@/modules/inspections/estimate-sources";

describe("collectInspectionEstimateSources", () => {
  it("uses priced findings lines with Part Or Detail text", () => {
    const lines = collectInspectionEstimateSources([
      {
        label: "Brake",
        notes: JSON.stringify([
          { note: "Front pads", quantity: 2, unitPricePaise: 50_000 },
        ]),
        quantity: 2,
        unitPricePaise: 50_000,
      },
    ]);
    expect(lines).toEqual([
      {
        description: "Front pads",
        quantity: 2,
        unitPricePaise: 50_000,
      },
    ]);
  });

  it("falls back to the item label when the finding has a price but no text", () => {
    const lines = collectInspectionEstimateSources([
      {
        label: "Wiper",
        notes: JSON.stringify([
          { note: "", quantity: 1, unitPricePaise: 12_000 },
        ]),
        quantity: 1,
        unitPricePaise: 12_000,
      },
    ]);
    expect(lines).toEqual([
      {
        description: "Wiper",
        quantity: 1,
        unitPricePaise: 12_000,
      },
    ]);
  });

  it("uses item-level price when notes are empty", () => {
    const lines = collectInspectionEstimateSources([
      {
        label: "Battery",
        notes: null,
        quantity: 1,
        unitPricePaise: 80_000,
      },
    ]);
    expect(lines).toEqual([
      {
        description: "Battery",
        quantity: 1,
        unitPricePaise: 80_000,
      },
    ]);
  });

  it("returns no sources when nothing is priced", () => {
    expect(
      collectInspectionEstimateSources([
        {
          label: "Engine",
          notes: JSON.stringify([{ note: "Oil leak", quantity: 1, unitPricePaise: 0 }]),
          quantity: 1,
          unitPricePaise: 0,
        },
      ]),
    ).toEqual([]);
  });
});

describe("diffInspectionEstimateSources", () => {
  it("flags adds, price updates, and removals", () => {
    const diff = diffInspectionEstimateSources(
      [
        { description: "Pads", quantity: 1, unitPricePaise: 34_000 },
        { description: "Drum", quantity: 1, unitPricePaise: 2_400 },
      ],
      [
        { description: "Pads", quantity: 1, unitPricePaise: 3_400 },
        { description: "Old line", quantity: 1, unitPricePaise: 100 },
      ],
    );
    expect(diff.toAdd).toEqual([
      { description: "Drum", quantity: 1, unitPricePaise: 2_400 },
    ]);
    expect(diff.toUpdate).toEqual([
      {
        description: "Pads",
        quantity: 1,
        unitPricePaise: 34_000,
        previousQuantity: 1,
        previousUnitPricePaise: 3_400,
      },
    ]);
    expect(diff.toRemove).toEqual([
      { description: "Old line", quantity: 1, unitPricePaise: 100 },
    ]);
  });
});

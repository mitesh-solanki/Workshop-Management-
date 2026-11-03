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
        externalCheck: false,
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
        externalCheck: false,
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
        externalCheck: false,
      },
    ]);
  });

  it("marks outside-work findings", () => {
    const lines = collectInspectionEstimateSources([
      {
        label: "AC",
        notes: JSON.stringify([
          { note: "Wheel alignment", quantity: 1, unitPricePaise: 15_000 },
        ]),
        quantity: 1,
        unitPricePaise: 15_000,
        externalCheck: true,
      },
    ]);
    expect(lines).toEqual([
      {
        description: "Wheel alignment",
        quantity: 1,
        unitPricePaise: 15_000,
        externalCheck: true,
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
        {
          description: "Pads",
          quantity: 1,
          unitPricePaise: 34_000,
          externalCheck: false,
        },
        {
          description: "Drum",
          quantity: 1,
          unitPricePaise: 2_400,
          externalCheck: false,
        },
      ],
      [
        {
          description: "Pads",
          quantity: 1,
          unitPricePaise: 3_400,
          type: "PART",
        },
        { description: "Old line", quantity: 1, unitPricePaise: 100, type: "PART" },
      ],
    );
    expect(diff.toAdd).toEqual([
      {
        description: "Drum",
        quantity: 1,
        unitPricePaise: 2_400,
        externalCheck: false,
      },
    ]);
    expect(diff.toUpdate).toEqual([
      {
        description: "Pads",
        quantity: 1,
        unitPricePaise: 34_000,
        externalCheck: false,
        previousQuantity: 1,
        previousUnitPricePaise: 3_400,
      },
    ]);
    expect(diff.toRemove).toEqual([
      {
        description: "Old line",
        quantity: 1,
        unitPricePaise: 100,
        type: "PART",
      },
    ]);
  });

  it("flags outside-work type mismatches for sync", () => {
    const diff = diffInspectionEstimateSources(
      [
        {
          description: "Wheel alignment",
          quantity: 1,
          unitPricePaise: 15_000,
          externalCheck: true,
        },
      ],
      [
        {
          description: "Wheel alignment",
          quantity: 1,
          unitPricePaise: 15_000,
          type: "PART",
        },
      ],
    );
    expect(diff.toUpdate).toHaveLength(1);
    expect(diff.toUpdate[0]?.externalCheck).toBe(true);
  });
});

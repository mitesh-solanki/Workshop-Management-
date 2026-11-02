import { describe, expect, it } from "vitest";
import { alignInspectionFindingWithEstimateLine } from "@/modules/inspections/align-estimate-finding";

describe("alignInspectionFindingWithEstimateLine", () => {
  it("updates a matching sub-spare and keeps other lines", () => {
    const result = alignInspectionFindingWithEstimateLine(
      [
        {
          id: "item-1",
          label: "Brakes",
          notes: JSON.stringify([
            { note: "Pads", quantity: 1, unitPricePaise: 100 },
            { note: "Drum", quantity: 1, unitPricePaise: 200 },
          ]),
          quantity: 2,
          unitPricePaise: 300,
        },
      ],
      {
        matchDescription: "Pads",
        next: { description: "Front pads", quantity: 2, unitPricePaise: 150 },
      },
    );

    expect(result.changed).toBe(true);
    expect(result.items[0]?.notes).toContain("Front pads");
    expect(result.items[0]?.notes).toContain("Drum");
    expect(result.items[0]?.quantity).toBe(3);
    expect(result.items[0]?.unitPricePaise).toBe(350);
  });

  it("removes a matching sub-spare", () => {
    const result = alignInspectionFindingWithEstimateLine(
      [
        {
          id: "item-1",
          label: "Brakes",
          notes: JSON.stringify([
            { note: "Pads", quantity: 1, unitPricePaise: 100 },
            { note: "Drum", quantity: 1, unitPricePaise: 200 },
          ]),
          quantity: 2,
          unitPricePaise: 300,
        },
      ],
      { matchDescription: "Pads", next: null },
    );

    expect(result.changed).toBe(true);
    expect(result.items[0]?.notes).not.toContain("Pads");
    expect(result.items[0]?.notes).toContain("Drum");
    expect(result.items[0]?.quantity).toBe(1);
    expect(result.items[0]?.unitPricePaise).toBe(200);
  });

  it("updates item-level findings when there are no sub-spares", () => {
    const result = alignInspectionFindingWithEstimateLine(
      [
        {
          id: "item-2",
          label: "AC Gas",
          notes: null,
          quantity: 1,
          unitPricePaise: 13300,
        },
      ],
      {
        matchDescription: "AC Gas",
        next: { description: "AC Gas refill", quantity: 1, unitPricePaise: 20000 },
      },
    );

    expect(result.changed).toBe(true);
    expect(result.items[0]?.label).toBe("AC Gas refill");
    expect(result.items[0]?.unitPricePaise).toBe(20000);
  });
});

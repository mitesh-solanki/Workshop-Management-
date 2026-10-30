import { describe, expect, it } from "vitest";
import {
  buildInspectionReportCheckedOk,
  buildInspectionReportPricedLines,
} from "@/modules/inspections/report-lines";

describe("inspection report lines", () => {
  it("builds priced lines from findings including label fallback", () => {
    const lines = buildInspectionReportPricedLines([
      {
        id: "1",
        label: "Brakes",
        notes: JSON.stringify([
          { note: "Front pads", quantity: 1, unitPricePaise: 24_400 },
          { note: "", quantity: 1, unitPricePaise: 40_000 },
        ]),
        quantity: 2,
        unitPricePaise: 64_400,
        externalCheck: false,
        result: "NEEDS_ATTENTION",
      },
    ]);
    expect(lines).toEqual([
      {
        description: "Front pads",
        quantity: 1,
        unitPricePaise: 24_400,
        lineTotalPaise: 24_400,
      },
      {
        description: "Brakes",
        quantity: 1,
        unitPricePaise: 40_000,
        lineTotalPaise: 40_000,
      },
    ]);
  });

  it("lists Marked Good only when there is no priced finding", () => {
    const ok = buildInspectionReportCheckedOk([
      {
        id: "bat",
        label: "Battery",
        notes: null,
        quantity: 1,
        unitPricePaise: 0,
        externalCheck: false,
        result: "OK",
      },
      {
        id: "brk",
        label: "Brakes",
        notes: JSON.stringify([
          { note: "Pads", quantity: 1, unitPricePaise: 10_000 },
        ]),
        quantity: 1,
        unitPricePaise: 10_000,
        externalCheck: false,
        result: "OK",
      },
    ]);
    expect(ok.map((item) => item.label)).toEqual(["Battery"]);
  });
});

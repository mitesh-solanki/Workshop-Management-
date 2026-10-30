import { multiplyByQuantity, type Paise } from "@/lib/money";
import { collectInspectionEstimateSources } from "@/modules/inspections/estimate-sources";
import { parseInspectionSubSpares } from "@/modules/inspections/sub-spares";

export type InspectionReportSourceItem = {
  id: string;
  label: string;
  notes: string | null;
  quantity: number;
  unitPricePaise: number;
  externalCheck: boolean;
  result?: "OK" | "NEEDS_ATTENTION" | "URGENT" | null;
};

export type InspectionReportPricedLine = {
  description: string;
  quantity: number;
  unitPricePaise: number;
  lineTotalPaise: number;
};

/** Same priced lines for on-screen report and PDF. */
export function buildInspectionReportPricedLines(
  items: InspectionReportSourceItem[],
): InspectionReportPricedLine[] {
  return collectInspectionEstimateSources(items).map((line) => ({
    description: line.description,
    quantity: line.quantity,
    unitPricePaise: line.unitPricePaise,
    lineTotalPaise: multiplyByQuantity(
      line.unitPricePaise as Paise,
      line.quantity,
    ),
  }));
}

export function buildInspectionReportCheckedOk(
  items: InspectionReportSourceItem[],
) {
  return items.filter(
    (item) =>
      item.result === "OK" &&
      !parseInspectionSubSpares(
        item.notes,
        item.quantity,
        item.unitPricePaise,
      ).some((line) => line.unitPricePaise > 0),
  );
}

export function buildInspectionReportExternalOnly(
  items: InspectionReportSourceItem[],
) {
  return items.filter(
    (item) =>
      item.externalCheck &&
      !parseInspectionSubSpares(
        item.notes,
        item.quantity,
        item.unitPricePaise,
      ).some((line) => line.unitPricePaise > 0),
  );
}

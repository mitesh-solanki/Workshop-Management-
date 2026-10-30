import { parseInspectionSubSpares } from "@/modules/inspections/sub-spares";

export type InspectionEstimateSourceItem = {
  label: string;
  notes: string | null;
  quantity: number;
  unitPricePaise: number;
};

export type InspectionEstimateSourceLine = {
  description: string;
  quantity: number;
  unitPricePaise: number;
};

/** Priced findings used to seed an inspection estimate (same rules client + server). */
export function collectInspectionEstimateSources(
  items: InspectionEstimateSourceItem[],
): InspectionEstimateSourceLine[] {
  const fromSubSpares: InspectionEstimateSourceLine[] = items.flatMap(
    (item) =>
      parseInspectionSubSpares(item.notes, item.quantity, item.unitPricePaise)
        .filter((line) => line.unitPricePaise > 0)
        .map((line) => ({
          description: line.description.trim() || item.label.trim(),
          quantity: line.quantity,
          unitPricePaise: line.unitPricePaise,
        }))
        .filter((line) => line.description.length > 0),
  );
  if (fromSubSpares.length > 0) {
    return fromSubSpares;
  }
  return items
    .filter((item) => item.unitPricePaise > 0 && item.label.trim())
    .map((item) => ({
      description: item.label.trim(),
      quantity: item.quantity >= 1 ? item.quantity : 1,
      unitPricePaise: item.unitPricePaise,
    }));
}

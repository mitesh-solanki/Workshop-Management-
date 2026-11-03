import { parseInspectionSubSpares } from "@/modules/inspections/sub-spares";

export type InspectionEstimateSourceItem = {
  label: string;
  notes: string | null;
  quantity: number;
  unitPricePaise: number;
  externalCheck?: boolean;
};

export type InspectionEstimateSourceLine = {
  description: string;
  quantity: number;
  unitPricePaise: number;
  /** Outside Work finding — estimate line type OUTSIDE, not PART. */
  externalCheck: boolean;
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
          externalCheck: Boolean(item.externalCheck),
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
      externalCheck: Boolean(item.externalCheck),
    }));
}

export type EstimateLineSnapshot = {
  description: string;
  quantity: number;
  unitPricePaise: number;
  type?: string;
};

export type InspectionEstimateSyncDiff = {
  toAdd: InspectionEstimateSourceLine[];
  toUpdate: Array<
    InspectionEstimateSourceLine & {
      previousQuantity: number;
      previousUnitPricePaise: number;
    }
  >;
  toRemove: EstimateLineSnapshot[];
};

function lineKey(description: string): string {
  return description.trim().toLowerCase();
}

function expectedEstimateType(
  externalCheck: boolean,
): "OUTSIDE" | "PART" {
  return externalCheck ? "OUTSIDE" : "PART";
}

/** Compare live findings to current estimate lines (add / price-qty/type change / remove). */
export function diffInspectionEstimateSources(
  sources: InspectionEstimateSourceLine[],
  estimateLines: EstimateLineSnapshot[],
): InspectionEstimateSyncDiff {
  const byEstimate = new Map(
    estimateLines.map((line) => [lineKey(line.description), line]),
  );
  const sourceKeys = new Set(sources.map((source) => lineKey(source.description)));

  const toAdd: InspectionEstimateSourceLine[] = [];
  const toUpdate: InspectionEstimateSyncDiff["toUpdate"] = [];

  for (const source of sources) {
    const existing = byEstimate.get(lineKey(source.description));
    if (!existing) {
      toAdd.push(source);
      continue;
    }
    const expectedType = expectedEstimateType(source.externalCheck);
    const typeMismatch =
      existing.type != null && existing.type !== expectedType;
    if (
      existing.quantity !== source.quantity ||
      existing.unitPricePaise !== source.unitPricePaise ||
      typeMismatch
    ) {
      toUpdate.push({
        ...source,
        previousQuantity: existing.quantity,
        previousUnitPricePaise: existing.unitPricePaise,
      });
    }
  }

  const toRemove = estimateLines.filter(
    (line) => !sourceKeys.has(lineKey(line.description)),
  );

  return { toAdd, toUpdate, toRemove };
}

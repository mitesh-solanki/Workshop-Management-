import { parseInspectionSubSpares } from "@/modules/inspections/sub-spares";

export type InspectionFindingItem = {
  id: string;
  label: string;
  notes: string | null;
  quantity: number;
  unitPricePaise: number;
};

export type AlignedInspectionFindingItem = InspectionFindingItem;

function lineKey(value: string): string {
  return value.trim().toLowerCase();
}

function serializeSubSpares(
  lines: Array<{ description: string; quantity: number; unitPricePaise: number }>,
): string | null {
  const rows = lines
    .map((line) => ({
      note: line.description.trim(),
      quantity: line.quantity >= 1 ? line.quantity : 1,
      unitPricePaise: line.unitPricePaise,
    }))
    .filter(
      (line) =>
        line.note.length > 0 ||
        line.quantity !== 1 ||
        line.unitPricePaise !== 0,
    );
  if (rows.length === 0) return null;
  return JSON.stringify(rows);
}

function withAggregates(
  item: InspectionFindingItem,
  notes: string | null,
  lines: Array<{ quantity: number; unitPricePaise: number }>,
): AlignedInspectionFindingItem {
  if (lines.length === 0) {
    return {
      ...item,
      notes: null,
      quantity: 1,
      unitPricePaise: 0,
    };
  }
  return {
    ...item,
    notes,
    quantity: lines.reduce((sum, line) => sum + line.quantity, 0),
    unitPricePaise: lines.reduce((sum, line) => sum + line.unitPricePaise, 0),
  };
}

/** Patch or remove a finding that matches an estimate line description. */
export function alignInspectionFindingWithEstimateLine(
  items: InspectionFindingItem[],
  input: {
    matchDescription: string;
    next:
      | {
          description: string;
          quantity: number;
          unitPricePaise: number;
        }
      | null;
  },
): { items: AlignedInspectionFindingItem[]; changed: boolean } {
  const matchKey = lineKey(input.matchDescription);
  let changed = false;

  const nextItems = items.map((item) => {
    const subSpares = parseInspectionSubSpares(
      item.notes,
      item.quantity,
      item.unitPricePaise,
    );
    const pricedSubSpares = subSpares.filter(
      (line) =>
        line.unitPricePaise > 0 &&
        (line.description.trim() || item.label.trim()).length > 0,
    );

    if (pricedSubSpares.length > 0 || (item.notes?.trim().startsWith("[") ?? false)) {
      const nextLines: Array<{
        description: string;
        quantity: number;
        unitPricePaise: number;
      }> = [];
      for (const line of subSpares) {
        const description = line.description.trim() || item.label.trim();
        if (lineKey(description) !== matchKey) {
          nextLines.push({
            description,
            quantity: line.quantity,
            unitPricePaise: line.unitPricePaise,
          });
          continue;
        }
        changed = true;
        if (input.next) {
          nextLines.push({
            description: input.next.description.trim(),
            quantity: input.next.quantity,
            unitPricePaise: input.next.unitPricePaise,
          });
        }
      }
      if (!changed) return item;
      return withAggregates(item, serializeSubSpares(nextLines), nextLines);
    }

    if (lineKey(item.label) !== matchKey) {
      return item;
    }
    changed = true;
    if (!input.next) {
      return {
        ...item,
        quantity: 1,
        unitPricePaise: 0,
        notes: null,
      };
    }
    return {
      ...item,
      label: input.next.description.trim() || item.label,
      quantity: input.next.quantity,
      unitPricePaise: input.next.unitPricePaise,
      notes: null,
    };
  });

  return { items: nextItems, changed };
}

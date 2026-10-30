export type InspectionSubSpare = {
  description: string;
  quantity: number;
  unitPricePaise: number;
};

/** Sub-spare rows stored in InspectionItem.notes (JSON or legacy plain text). */
export function parseInspectionSubSpares(
  notes: string | null,
  fallbackQuantity = 1,
  fallbackUnitPricePaise = 0,
): InspectionSubSpare[] {
  if (notes?.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(notes) as unknown;
      if (Array.isArray(parsed)) {
        const lines = parsed
          .map((row) => {
            if (!row || typeof row !== "object") return null;
            const record = row as Record<string, unknown>;
            let description =
              typeof record.note === "string"
                ? record.note.trim()
                : typeof record.text === "string"
                  ? record.text.trim()
                  : typeof record.description === "string"
                    ? record.description.trim()
                    : "";
            // Recover accidental "JSON stuck in observation" from a prior parse bug.
            if (description.startsWith("[{")) {
              description = "";
            }
            const quantity =
              typeof record.quantity === "number" && record.quantity >= 1
                ? record.quantity
                : 1;
            const unitPricePaise =
              typeof record.unitPricePaise === "number"
                ? record.unitPricePaise
                : 0;
            // Keep qty/price-only rows — do not drop them or JSON falls through as plain text.
            if (!description && quantity === 1 && unitPricePaise <= 0) {
              return null;
            }
            return { description, quantity, unitPricePaise };
          })
          .filter((row): row is InspectionSubSpare => row != null);

        // Valid JSON array must never be treated as legacy plain notes.
        if (lines.length > 0) return lines;
        return [
          {
            description: "",
            quantity: fallbackQuantity >= 1 ? fallbackQuantity : 1,
            unitPricePaise: fallbackUnitPricePaise,
          },
        ];
      }
    } catch {
      // fall through to legacy plain notes
    }
  }

  if (notes?.trim()) {
    // Never show raw JSON blobs as observation text.
    if (notes.trim().startsWith("[")) {
      return [
        {
          description: "",
          quantity: fallbackQuantity >= 1 ? fallbackQuantity : 1,
          unitPricePaise: fallbackUnitPricePaise,
        },
      ];
    }
    return notes.split("\n").map((text) => ({
      description: text.trim(),
      quantity: fallbackQuantity,
      unitPricePaise: fallbackUnitPricePaise,
    }));
  }

  return [];
}

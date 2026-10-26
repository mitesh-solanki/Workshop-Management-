/** Pure FormData parsing for direct-sale actions (unit-testable). */

export type DirectSaleFormLine = {
  partId: string;
  quantity: string;
  unitPricePaise: string;
};

export type DirectSaleFormPayload = {
  customerId: string;
  walkInName: string;
  notes: string;
  lines: DirectSaleFormLine[];
};

/**
 * Reads parallel `partId` / `quantity` / `unitPriceRupees` fields from the
 * multi-line direct-sale form into a createDirectSale payload shape.
 */
export function parseDirectSaleFormData(formData: FormData): DirectSaleFormPayload {
  const partIds = formData.getAll("partId").map((value) => String(value));
  const quantities = formData.getAll("quantity").map((value) => String(value));
  const unitPrices = formData
    .getAll("unitPriceRupees")
    .map((value) => String(value));

  const lineCount = Math.min(
    partIds.length,
    quantities.length,
    unitPrices.length,
  );

  const lines: DirectSaleFormLine[] = [];
  for (let i = 0; i < lineCount; i += 1) {
    lines.push({
      partId: partIds[i] ?? "",
      quantity: quantities[i] ?? "",
      unitPricePaise: unitPrices[i] ?? "0",
    });
  }

  return {
    customerId: String(formData.get("customerId") ?? ""),
    walkInName: String(formData.get("walkInName") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    lines,
  };
}

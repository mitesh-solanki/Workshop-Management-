/**
 * Pure stock math. Current quantity is always the sum of signed quantityChange values.
 * Never edit Part quantity directly — only append StockMovement rows.
 */

export type StockMovementTypeValue = "IN" | "OUT" | "ADJUSTMENT";

/** Signed delta that a movement applies to on-hand quantity. */
export function quantityChangeForMovement(
  type: StockMovementTypeValue,
  quantity: number,
): number {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("quantity must be a positive integer");
  }
  if (type === "IN") {
    return quantity;
  }
  if (type === "OUT") {
    return -quantity;
  }
  // ADJUSTMENT: caller passes signed quantity via signedAdjustmentQuantity
  throw new Error("Use signedAdjustmentQuantity for ADJUSTMENT movements");
}

/** ADJUSTMENT uses a signed non-zero delta (increase or decrease). */
export function signedAdjustmentQuantity(delta: number): number {
  if (!Number.isInteger(delta) || delta === 0) {
    throw new Error("adjustment delta must be a non-zero integer");
  }
  return delta;
}

export function sumStock(
  movements: ReadonlyArray<{ quantityChange: number }>,
): number {
  let total = 0;
  for (const movement of movements) {
    if (!Number.isInteger(movement.quantityChange)) {
      throw new Error("quantityChange must be an integer");
    }
    total += movement.quantityChange;
  }
  return total;
}

/**
 * Whether applying `quantityChange` to `currentStock` is allowed.
 * Returns the resulting stock when allowed.
 */
export function assertStockChangeAllowed(input: {
  currentStock: number;
  quantityChange: number;
  allowNegativeStock: boolean;
}): { ok: true; resultingStock: number } | { ok: false; resultingStock: number } {
  const resultingStock = input.currentStock + input.quantityChange;
  if (resultingStock < 0 && !input.allowNegativeStock) {
    return { ok: false, resultingStock };
  }
  return { ok: true, resultingStock };
}

export function isLowStock(currentStock: number, lowStockLevel: number): boolean {
  return currentStock <= lowStockLevel;
}

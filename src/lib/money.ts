/** Money amounts are integer paise (1 rupee = 100 paise). Never use floats. */

export type Paise = number;

function assertPaise(value: number, label: string): asserts value is Paise {
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be an integer number of paise`);
  }
}

/** Sum paise amounts. */
export function add(...amounts: Paise[]): Paise {
  let total = 0;
  for (const amount of amounts) {
    assertPaise(amount, "amount");
    total += amount;
  }
  return total;
}

/** Multiply a unit price in paise by a quantity (integer or decimal). Result is rounded to nearest paise. */
export function multiplyByQuantity(unitPaise: Paise, quantity: number): Paise {
  assertPaise(unitPaise, "unitPaise");
  if (!Number.isFinite(quantity)) {
    throw new Error("quantity must be a finite number");
  }
  return Math.round(unitPaise * quantity);
}

/**
 * Percentage of an amount in paise.
 * Uses half-up rounding via Math.round (e.g. GST line rounding).
 */
export function percentage(amountPaise: Paise, percent: number): Paise {
  assertPaise(amountPaise, "amountPaise");
  if (!Number.isFinite(percent)) {
    throw new Error("percent must be a finite number");
  }
  return Math.round((amountPaise * percent) / 100);
}

/** Format paise as Indian rupees, e.g. 125050 → "₹1,250.50". */
export function formatRupees(amountPaise: Paise, locale = "en-IN"): string {
  assertPaise(amountPaise, "amountPaise");
  const rupees = amountPaise / 100;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}

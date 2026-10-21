/** Money amounts are integer paise (1 rupee = 100 paise). Never use floats. */

import { z } from "zod";

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

/**
 * Parse a rupee form value ("250", "250.50", "") into integer paise.
 * Empty → 0. Returns null when the string is not a valid price.
 */
export function parseRupeesToPaise(value: string | number): Paise | null {
  const raw = typeof value === "number" ? String(value) : value.trim();
  if (raw === "") {
    return 0;
  }
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    return null;
  }
  const [rupeesPart, paisePart = ""] = raw.split(".");
  const rupees = Number(rupeesPart);
  const paise = paisePart.padEnd(2, "0").slice(0, 2);
  const total = rupees * 100 + Number(paise);
  if (!Number.isInteger(total) || total < 0) {
    return null;
  }
  return total;
}

/** Format paise for an editable rupee input. Zero → empty so typing does not leave a leading 0. */
export function paiseToRupeesInput(amountPaise: Paise): string {
  assertPaise(amountPaise, "amountPaise");
  if (amountPaise === 0) {
    return "";
  }
  const rupees = Math.floor(amountPaise / 100);
  const paise = amountPaise % 100;
  if (paise === 0) {
    return String(rupees);
  }
  return `${rupees}.${String(paise).padStart(2, "0")}`;
}

/** True when the field still holds only a zero placeholder. */
export function isZeroRupeesInput(value: string): boolean {
  const trimmed = value.trim();
  return trimmed === "" || trimmed === "0" || trimmed === "0.0" || trimmed === "0.00";
}

/**
 * Strip letters/symbols while typing a rupee amount.
 * Keeps digits, at most one `.`, and at most two decimal places.
 */
export function sanitizeRupeesTyping(value: string): string {
  let cleaned = value.replace(/[^\d.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) {
    return cleaned;
  }
  const whole = cleaned.slice(0, firstDot);
  const fraction = cleaned
    .slice(firstDot + 1)
    .replace(/\./g, "")
    .slice(0, 2);
  return `${whole}.${fraction}`;
}

/** Zod field: rupee string/number → integer paise (shared by order, inspection, estimate forms). */
export const rupeesToPaiseSchema = z
  .union([z.string(), z.number()])
  .transform((value, ctx) => {
    const parsed = parseRupeesToPaise(value);
    if (parsed == null) {
      ctx.addIssue({ code: "custom", message: "Invalid price" });
      return z.NEVER;
    }
    return parsed;
  });

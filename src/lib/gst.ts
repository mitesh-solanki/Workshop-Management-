import { add, multiplyByQuantity, percentage, type Paise } from "@/lib/money";

/** Inputs for a single taxable line (estimate or invoice). */
export type GstLineInput = {
  quantity: number;
  unitPricePaise: Paise;
  /** Whole-percent GST rate, e.g. 18 for 18%. */
  gstRatePercent: number;
};

export type GstLineAmounts = {
  taxablePaise: Paise;
  /** GST for this line after half-up rounding to the nearest paise. */
  gstPaise: Paise;
  totalPaise: Paise;
};

/**
 * Taxable amount × GST rate, rounded per line (half-up), then line total.
 * Never sum floats across lines — round each line first.
 */
export function computeLineGst(line: GstLineInput): GstLineAmounts {
  if (!Number.isInteger(line.gstRatePercent) || line.gstRatePercent < 0) {
    throw new Error("gstRatePercent must be a non-negative integer");
  }
  const taxablePaise = multiplyByQuantity(line.unitPricePaise, line.quantity);
  const gstPaise = percentage(taxablePaise, line.gstRatePercent);
  return {
    taxablePaise,
    gstPaise,
    totalPaise: add(taxablePaise, gstPaise),
  };
}

export type EstimateTotals = {
  taxablePaise: Paise;
  gstPaise: Paise;
  totalPaise: Paise;
  lineCount: number;
};

/** Sum of per-line GST amounts (already rounded). Empty list → zeros. */
export function sumLineGst(lines: readonly GstLineInput[]): EstimateTotals {
  let taxablePaise = 0;
  let gstPaise = 0;
  let totalPaise = 0;
  for (const line of lines) {
    const amounts = computeLineGst(line);
    taxablePaise = add(taxablePaise, amounts.taxablePaise);
    gstPaise = add(gstPaise, amounts.gstPaise);
    totalPaise = add(totalPaise, amounts.totalPaise);
  }
  return {
    taxablePaise,
    gstPaise,
    totalPaise,
    lineCount: lines.length,
  };
}

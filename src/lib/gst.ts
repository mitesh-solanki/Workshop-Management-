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

export type GstSplitKindValue = "CGST_SGST" | "IGST";

export type GstComponentSplit = {
  kind: GstSplitKindValue;
  cgstPaise: Paise;
  sgstPaise: Paise;
  igstPaise: Paise;
};

export type GstLineSplitAmounts = GstLineAmounts & GstComponentSplit;

export type InvoiceGstTotals = {
  taxablePaise: Paise;
  cgstPaise: Paise;
  sgstPaise: Paise;
  igstPaise: Paise;
  /** cgst + sgst + igst */
  gstPaise: Paise;
  totalPaise: Paise;
  lineCount: number;
  kind: GstSplitKindValue;
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

/**
 * Same-state → CGST+SGST (half each; odd paise goes to SGST so components sum to gst).
 * Other-state → full amount as IGST.
 */
export function splitGstComponents(
  gstPaise: Paise,
  sameState: boolean,
): GstComponentSplit {
  if (!Number.isInteger(gstPaise) || gstPaise < 0) {
    throw new Error("gstPaise must be a non-negative integer");
  }
  if (sameState) {
    const cgstPaise = Math.floor(gstPaise / 2);
    const sgstPaise = gstPaise - cgstPaise;
    return {
      kind: "CGST_SGST",
      cgstPaise,
      sgstPaise,
      igstPaise: 0,
    };
  }
  return {
    kind: "IGST",
    cgstPaise: 0,
    sgstPaise: 0,
    igstPaise: gstPaise,
  };
}

/** True when seller and place-of-supply state codes match (intra-state). */
export function isSameStateSupply(
  sellerStateCode: string,
  placeOfSupplyStateCode: string,
): boolean {
  return (
    sellerStateCode.trim() === placeOfSupplyStateCode.trim() &&
    sellerStateCode.trim().length > 0
  );
}

/** Per-line GST with CGST/SGST or IGST components. */
export function computeLineGstSplit(
  line: GstLineInput,
  sameState: boolean,
): GstLineSplitAmounts {
  const base = computeLineGst(line);
  const split = splitGstComponents(base.gstPaise, sameState);
  return { ...base, ...split };
}

/**
 * Sum per-line rounded GST, then expose CGST/SGST or IGST totals.
 * Split kind is derived from `sameState` (must match how each line was split).
 */
export function sumLineGstSplit(
  lines: readonly GstLineInput[],
  sameState: boolean,
): InvoiceGstTotals {
  const kind: GstSplitKindValue = sameState ? "CGST_SGST" : "IGST";
  let taxablePaise = 0;
  let cgstPaise = 0;
  let sgstPaise = 0;
  let igstPaise = 0;
  let totalPaise = 0;
  for (const line of lines) {
    const amounts = computeLineGstSplit(line, sameState);
    taxablePaise = add(taxablePaise, amounts.taxablePaise);
    cgstPaise = add(cgstPaise, amounts.cgstPaise);
    sgstPaise = add(sgstPaise, amounts.sgstPaise);
    igstPaise = add(igstPaise, amounts.igstPaise);
    totalPaise = add(totalPaise, amounts.totalPaise);
  }
  return {
    taxablePaise,
    cgstPaise,
    sgstPaise,
    igstPaise,
    gstPaise: add(cgstPaise, sgstPaise, igstPaise),
    totalPaise,
    lineCount: lines.length,
    kind,
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

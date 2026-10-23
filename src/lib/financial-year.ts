/** Indian financial year helpers (1 April – 31 March). */

/**
 * Calendar year of the FY that contains `date`.
 * e.g. 15 May 2025 → 2025 (FY 2025-26); 10 Mar 2026 → 2025.
 */
export function financialYearStart(date: Date = new Date()): number {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0 = Jan … 3 = Apr
  return month >= 3 ? year : year - 1;
}

/** Label like "2025-26" for FY starting in calendar year `start`. */
export function formatFinancialYearLabel(start: number): string {
  const endTwo = String((start + 1) % 100).padStart(2, "0");
  return `${start}-${endTwo}`;
}

/**
 * Short garage code from the garage name for invoice prefixes.
 * "Prime Motors" → "PM"; "Maruti" → "MAR"; empty → "XX".
 */
export function garageInvoiceCode(name: string): string {
  const words = name
    .trim()
    .split(/[\s\-_./]+/)
    .map((word) => word.replace(/[^A-Za-z0-9]/g, ""))
    .filter((word) => word.length > 0 && /^[A-Za-z]/.test(word));

  if (words.length === 0) {
    return "XX";
  }

  if (words.length === 1) {
    const word = words[0]!.toUpperCase();
    if (word.length === 1) {
      return `${word}X`;
    }
    return word.slice(0, Math.min(3, word.length));
  }

  return words
    .slice(0, 4)
    .map((word) => word[0]!.toUpperCase())
    .join("");
}

/** Invoice number: INV-PM/2025-26/0001 */
export function formatInvoiceNumber(
  financialYearStartYear: number,
  sequence: number,
  garageCode = "XX",
): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error("sequence must be a positive integer");
  }
  const code = garageCode.trim().toUpperCase() || "XX";
  return `INV-${code}/${formatFinancialYearLabel(financialYearStartYear)}/${String(sequence).padStart(4, "0")}`;
}

/** Credit note number: CN-PM/2025-26/0001 */
export function formatCreditNoteNumber(
  financialYearStartYear: number,
  sequence: number,
  garageCode = "XX",
): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error("sequence must be a positive integer");
  }
  const code = garageCode.trim().toUpperCase() || "XX";
  return `CN-${code}/${formatFinancialYearLabel(financialYearStartYear)}/${String(sequence).padStart(4, "0")}`;
}

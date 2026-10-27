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

/** Invoice number: INV-2025-26-0001 (sequential per garage per FY). */
export function formatInvoiceNumber(
  financialYearStartYear: number,
  sequence: number,
): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error("sequence must be a positive integer");
  }
  return `INV-${formatFinancialYearLabel(financialYearStartYear)}-${String(sequence).padStart(4, "0")}`;
}

/** Credit note number: CN-2025-26-0001 */
export function formatCreditNoteNumber(
  financialYearStartYear: number,
  sequence: number,
): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error("sequence must be a positive integer");
  }
  return `CN-${formatFinancialYearLabel(financialYearStartYear)}-${String(sequence).padStart(4, "0")}`;
}

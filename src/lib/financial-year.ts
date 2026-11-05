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

/** Display invoice label using job card number: INV-2025-26-259. */
export function formatJobCardInvoiceNumber(
  financialYearStartYear: number,
  jobCardNumber: number,
): string {
  if (!Number.isInteger(jobCardNumber) || jobCardNumber < 1) {
    throw new Error("jobCardNumber must be a positive integer");
  }
  return `INV-${formatFinancialYearLabel(financialYearStartYear)}-${jobCardNumber}`;
}

/**
 * What staff see on bills / PDFs / lists.
 * Prefer INV-{FY}-{jobCardNumber}; fall back to stored sequential invoice number.
 */
export function displayInvoiceNumber(input: {
  invoiceNumber?: string | null;
  jobCardNumber?: number | null;
  at?: Date | string | null;
}): string | null {
  const stored = input.invoiceNumber?.trim() || null;
  if (!stored) {
    return null;
  }
  if (input.jobCardNumber != null && Number.isFinite(input.jobCardNumber)) {
    const fyFromStored = stored.match(/^(INV-\d{4}-\d{2})(?:-|$)/)?.[1];
    if (fyFromStored) {
      return `${fyFromStored}-${input.jobCardNumber}`;
    }
    const at =
      input.at == null
        ? new Date()
        : input.at instanceof Date
          ? input.at
          : new Date(input.at);
    const fy = Number.isNaN(at.getTime())
      ? financialYearStart()
      : financialYearStart(at);
    return formatJobCardInvoiceNumber(fy, input.jobCardNumber);
  }
  return stored;
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

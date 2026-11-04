/** Positive integer Job Card numbers (no prefix). */
export function parseJobCardNumberInput(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isInteger(raw) && raw >= 1) {
    return raw;
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!/^\d+$/.test(trimmed)) {
      return null;
    }
    const n = Number(trimmed);
    if (!Number.isInteger(n) || n < 1 || n > 2_147_483_647) {
      return null;
    }
    return n;
  }
  return null;
}

export function formatJobCardNumberLabel(jobCardNumber: number): string {
  return `#${jobCardNumber}`;
}

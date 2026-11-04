import { CSV_UTF8_BOM, escapeCsvCell } from "@/lib/csv";

export function formatReportDateDdMmYyyy(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

export function paiseToExportNumber(amountPaise: number): string {
  return (amountPaise / 100).toFixed(2);
}

export function todayExportStamp(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function exportUserSlug(name: string | null, email: string): string {
  const raw = (name?.trim() || email.split("@")[0] || "user")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24);
  return raw || "user";
}

export type SleekBillCsvInput = {
  title: string;
  userLabel: string;
  gstin: string | null;
  rangeLine: string;
  headers: readonly string[];
  rows: readonly (readonly string[])[];
  /** Optional rows after data (e.g. Total). */
  footerRows?: readonly (readonly string[])[];
};

/**
 * Excel-friendly CSV matching Sleek Bill export layout:
 * title, user, GSTIN, date range, blank, then header + data rows + totals.
 */
export function buildSleekBillCsv(input: SleekBillCsvInput): string {
  const width = Math.max(input.headers.length, 1);

  function pad(cells: readonly string[]): string {
    const next = cells.slice(0, width);
    while (next.length < width) {
      next.push("");
    }
    return next.map((cell) => escapeCsvCell(cell)).join(",");
  }

  const lines = [
    pad([input.title]),
    pad(["", "", input.userLabel]),
    pad([`GSTIN No.: ${input.gstin?.trim() ?? ""}`]),
    pad([input.rangeLine]),
    pad([]),
    pad(input.headers),
    ...input.rows.map((row) => pad(row)),
    ...(input.footerRows?.length
      ? [pad([]), ...input.footerRows.map((row) => pad(row))]
      : []),
  ];

  return `${CSV_UTF8_BOM}${lines.join("\r\n")}`;
}

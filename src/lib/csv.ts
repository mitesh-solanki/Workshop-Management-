/**
 * Shared CSV export helpers. Use from any module to turn typed rows into a
 * downloadable CSV (Excel-friendly UTF-8 with BOM).
 */

/** UTF-8 BOM so Excel opens non-ASCII (Hindi/Gujarati) correctly. */
export const CSV_UTF8_BOM = "\uFEFF";

export type CsvCellValue =
  | string
  | number
  | boolean
  | Date
  | null
  | undefined;

export type CsvColumn<T> = {
  /** Column header shown in the first row. */
  header: string;
  /** Extract a cell value from a data row. */
  value: (row: T) => CsvCellValue;
};

export type RowsToCsvOptions = {
  /** Include UTF-8 BOM (default true — needed for Excel). */
  includeBom?: boolean;
  /** Field delimiter (default ","). */
  delimiter?: string;
  /** Line ending (default "\r\n" for Excel on Windows). */
  lineEnding?: "\n" | "\r\n";
};

/**
 * Escape a single CSV cell per RFC 4180:
 * quote when the value contains delimiter, quote, or newline; double quotes inside.
 */
export function escapeCsvCell(
  value: CsvCellValue,
  delimiter = ",",
): string {
  const raw = cellToString(value);
  const needsQuotes =
    raw.includes('"') ||
    raw.includes(delimiter) ||
    raw.includes("\n") ||
    raw.includes("\r");

  if (!needsQuotes) {
    return raw;
  }
  return `"${raw.replaceAll('"', '""')}"`;
}

function cellToString(value: CsvCellValue): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return "";
    }
    return value.toISOString();
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return "";
    }
    return String(value);
  }
  return String(value);
}

/** Build a CSV string from column definitions and row data. */
export function rowsToCsv<T>(
  columns: readonly CsvColumn<T>[],
  rows: readonly T[],
  options: RowsToCsvOptions = {},
): string {
  if (columns.length === 0) {
    throw new Error("rowsToCsv requires at least one column");
  }

  const delimiter = options.delimiter ?? ",";
  const lineEnding = options.lineEnding ?? "\r\n";
  const includeBom = options.includeBom ?? true;

  const header = columns
    .map((col) => escapeCsvCell(col.header, delimiter))
    .join(delimiter);

  const body = rows.map((row) =>
    columns
      .map((col) => escapeCsvCell(col.value(row), delimiter))
      .join(delimiter),
  );

  const csv = [header, ...body].join(lineEnding);
  return includeBom ? `${CSV_UTF8_BOM}${csv}` : csv;
}

/**
 * Safe download filename: strip path separators and control chars,
 * ensure a .csv extension.
 */
export function sanitizeCsvFilename(filename: string): string {
  const cleaned = filename
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .replace(/\.+$/, "");

  // Only hyphens/dots left → treat as empty (e.g. "???" → "---").
  const base = /^[.-]*$/.test(cleaned) ? "" : cleaned;

  const withExt =
    base.toLowerCase().endsWith(".csv") && base.length > 4
      ? base
      : `${base || "export"}.csv`;

  return withExt.slice(0, 180);
}

export type CsvDownloadResponseOptions = {
  /** Filename for Content-Disposition (sanitized). */
  filename: string;
  /** Extra response headers. */
  headers?: HeadersInit;
};

/**
 * Build a Next.js / Fetch `Response` that downloads as a CSV file.
 * Body may already include a BOM from `rowsToCsv`.
 */
export function csvDownloadResponse(
  csvBody: string,
  options: CsvDownloadResponseOptions,
): Response {
  const filename = sanitizeCsvFilename(options.filename);
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "text/csv; charset=utf-8");
  headers.set(
    "Content-Disposition",
    `attachment; filename="${filename}"`,
  );
  headers.set("Cache-Control", "no-store");

  return new Response(csvBody, { status: 200, headers });
}

/**
 * Convenience: columns + rows → downloadable Response.
 */
export function rowsToCsvDownloadResponse<T>(
  columns: readonly CsvColumn<T>[],
  rows: readonly T[],
  options: CsvDownloadResponseOptions & RowsToCsvOptions,
): Response {
  const { filename, headers, ...csvOptions } = options;
  return csvDownloadResponse(rowsToCsv(columns, rows, csvOptions), {
    filename,
    headers,
  });
}

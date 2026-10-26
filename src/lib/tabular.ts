/**
 * Parse CSV or Excel (.xlsx / .xls) into a header row + string cell matrix.
 * Used by data import.
 */

import * as XLSX from "xlsx";
import { CSV_UTF8_BOM } from "@/lib/csv";

export const MAX_IMPORT_ROWS = 1000;
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

export type TabularSheet = {
  headers: string[];
  /** Data rows only (no header). Each cell is a trimmed string. */
  rows: string[][];
};

export class TabularParseError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "TabularParseError";
    this.code = code;
  }
}

function cellToString(value: unknown): string {
  if (value == null) {
    return "";
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return "";
    }
    return value.toISOString().slice(0, 10);
  }
  return String(value).trim();
}

function normaliseHeader(value: string): string {
  return value.replace(CSV_UTF8_BOM, "").trim();
}

/**
 * Parse a UTF-8 CSV string (RFC 4180-ish) into a 2D string matrix.
 * Exported for tests; prefer `parseTabularBuffer` for files.
 */
export function parseCsvText(text: string): string[][] {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let i = 0;
  let inQuotes = false;

  while (i < input.length) {
    const ch = input[i]!;

    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(cell.trim());
      cell = "";
      i += 1;
      continue;
    }
    if (ch === "\r") {
      i += 1;
      continue;
    }
    if (ch === "\n") {
      row.push(cell.trim());
      cell = "";
      if (row.some((c) => c.length > 0) || rows.length === 0) {
        rows.push(row);
      }
      row = [];
      i += 1;
      continue;
    }
    cell += ch;
    i += 1;
  }

  row.push(cell.trim());
  if (row.some((c) => c.length > 0) || rows.length === 0) {
    rows.push(row);
  }

  return rows;
}

function matrixToSheet(matrix: string[][]): TabularSheet {
  if (matrix.length === 0) {
    throw new TabularParseError("import.empty_file");
  }

  const headerCells = matrix[0] ?? [];
  const headers = headerCells.map((h) => normaliseHeader(cellToString(h)));
  if (headers.every((h) => h.length === 0)) {
    throw new TabularParseError("import.empty_file");
  }

  const width = headers.length;
  const rows: string[][] = [];

  for (let r = 1; r < matrix.length; r += 1) {
    const raw = matrix[r] ?? [];
    const cells: string[] = [];
    let any = false;
    for (let c = 0; c < width; c += 1) {
      const value = cellToString(raw[c]);
      if (value.length > 0) {
        any = true;
      }
      cells.push(value);
    }
    if (!any) {
      continue;
    }
    rows.push(cells);
    if (rows.length > MAX_IMPORT_ROWS) {
      throw new TabularParseError("import.too_many_rows");
    }
  }

  if (rows.length === 0) {
    throw new TabularParseError("import.empty_file");
  }

  return { headers, rows };
}

function extensionOf(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? filename;
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot + 1).toLowerCase() : "";
}

function parseExcelBuffer(bytes: Uint8Array): string[][] {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(bytes, {
      type: "array",
      cellDates: true,
    });
  } catch {
    throw new TabularParseError("import.unsupported_type");
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new TabularParseError("import.empty_file");
  }
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new TabularParseError("import.empty_file");
  }

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: false,
  });

  return matrix.map((row) => {
    if (!Array.isArray(row)) {
      return [];
    }
    return row.map((cell) => cellToString(cell));
  });
}

/**
 * Parse CSV or Excel bytes into headers + rows.
 * Uses the first sheet of an Excel workbook.
 * @throws TabularParseError with stable `code` for i18n
 */
export function parseTabularBuffer(
  buffer: ArrayBuffer | Buffer | Uint8Array,
  filename: string,
): TabularSheet {
  const bytes =
    buffer instanceof ArrayBuffer
      ? new Uint8Array(buffer)
      : buffer instanceof Buffer
        ? new Uint8Array(buffer)
        : buffer;

  if (bytes.byteLength === 0) {
    throw new TabularParseError("import.empty_file");
  }
  if (bytes.byteLength > MAX_IMPORT_BYTES) {
    throw new TabularParseError("import.file_too_large");
  }

  const ext = extensionOf(filename);
  if (ext === "csv" || ext === "txt") {
    const text = new TextDecoder("utf-8").decode(bytes);
    return matrixToSheet(parseCsvText(text));
  }
  if (ext === "xlsx" || ext === "xls") {
    return matrixToSheet(parseExcelBuffer(bytes));
  }

  throw new TabularParseError("import.unsupported_type");
}

/** Suggest which file header index maps to a field, using aliases. */
export function suggestColumnMapping(
  headers: readonly string[],
  aliases: readonly string[],
): number | null {
  const normalisedHeaders = headers.map((h) =>
    h.toLowerCase().replace(/[\s_-]+/g, ""),
  );
  const normalisedAliases = aliases.map((a) =>
    a.toLowerCase().replace(/[\s_-]+/g, ""),
  );

  for (let i = 0; i < normalisedHeaders.length; i += 1) {
    const header = normalisedHeaders[i]!;
    if (!header) {
      continue;
    }
    if (normalisedAliases.includes(header)) {
      return i;
    }
  }
  return null;
}

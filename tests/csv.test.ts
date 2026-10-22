import { describe, expect, it } from "vitest";
import {
  CSV_UTF8_BOM,
  csvDownloadResponse,
  escapeCsvCell,
  rowsToCsv,
  rowsToCsvDownloadResponse,
  sanitizeCsvFilename,
} from "@/lib/csv";

describe("csv", () => {
  describe("escapeCsvCell", () => {
    it("passes through plain values", () => {
      expect(escapeCsvCell("abc")).toBe("abc");
      expect(escapeCsvCell(42)).toBe("42");
      expect(escapeCsvCell(true)).toBe("true");
      expect(escapeCsvCell(false)).toBe("false");
    });

    it("treats null and undefined as empty", () => {
      expect(escapeCsvCell(null)).toBe("");
      expect(escapeCsvCell(undefined)).toBe("");
    });

    it("quotes values with commas, quotes, or newlines", () => {
      expect(escapeCsvCell("a,b")).toBe('"a,b"');
      expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
      expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');
    });

    it("serializes dates as ISO strings", () => {
      const d = new Date("2026-04-01T00:00:00.000Z");
      expect(escapeCsvCell(d)).toBe("2026-04-01T00:00:00.000Z");
    });

    it("empties non-finite numbers and invalid dates", () => {
      expect(escapeCsvCell(Number.NaN)).toBe("");
      expect(escapeCsvCell(Number.POSITIVE_INFINITY)).toBe("");
      expect(escapeCsvCell(new Date("invalid"))).toBe("");
    });
  });

  describe("rowsToCsv", () => {
    type Row = { name: string; phone: string; notes?: string | null };

    const columns = [
      { header: "Name", value: (r: Row) => r.name },
      { header: "Phone", value: (r: Row) => r.phone },
      { header: "Notes", value: (r: Row) => r.notes },
    ] as const;

    it("builds a header and rows with BOM by default", () => {
      const csv = rowsToCsv(columns, [
        { name: "Ravi", phone: "9876543210", notes: null },
      ]);
      expect(csv.startsWith(CSV_UTF8_BOM)).toBe(true);
      expect(csv).toContain("Name,Phone,Notes");
      expect(csv).toContain("Ravi,9876543210,");
    });

    it("can omit the BOM", () => {
      const csv = rowsToCsv(columns, [], { includeBom: false });
      expect(csv.startsWith(CSV_UTF8_BOM)).toBe(false);
      expect(csv).toBe("Name,Phone,Notes");
    });

    it("escapes cells that need quoting", () => {
      const csv = rowsToCsv(
        columns,
        [{ name: "A, B", phone: "1", notes: 'he said "ok"' }],
        { includeBom: false, lineEnding: "\n" },
      );
      expect(csv).toBe(
        'Name,Phone,Notes\n"A, B",1,"he said ""ok"""',
      );
    });

    it("rejects empty column lists", () => {
      expect(() => rowsToCsv([], [])).toThrow(/at least one column/);
    });
  });

  describe("sanitizeCsvFilename", () => {
    it("adds .csv when missing", () => {
      expect(sanitizeCsvFilename("customers")).toBe("customers.csv");
    });

    it("strips unsafe characters", () => {
      expect(sanitizeCsvFilename("../parts/list?.csv")).toBe(
        "..-parts-list-.csv",
      );
    });

    it("falls back when empty after sanitizing", () => {
      expect(sanitizeCsvFilename("???")).toBe("export.csv");
    });
  });

  describe("csvDownloadResponse", () => {
    it("sets download headers", async () => {
      const res = csvDownloadResponse("a,b\n1,2", {
        filename: "parts.csv",
      });
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe(
        "text/csv; charset=utf-8",
      );
      expect(res.headers.get("Content-Disposition")).toBe(
        'attachment; filename="parts.csv"',
      );
      expect(res.headers.get("Cache-Control")).toBe("no-store");
      expect(await res.text()).toBe("a,b\n1,2");
    });
  });

  describe("rowsToCsvDownloadResponse", () => {
    it("combines rowsToCsv and download headers", async () => {
      const res = rowsToCsvDownloadResponse(
        [
          { header: "SKU", value: (r: { sku: string }) => r.sku },
          { header: "Qty", value: (r: { qty: number }) => r.qty },
        ],
        [{ sku: "OIL-1", qty: 2 }],
        { filename: "stock", includeBom: false, lineEnding: "\n" },
      );
      expect(res.headers.get("Content-Disposition")).toContain(
        "stock.csv",
      );
      expect(await res.text()).toBe("SKU,Qty\nOIL-1,2");
    });
  });
});

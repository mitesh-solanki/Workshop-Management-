import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  parseCsvText,
  parseTabularBuffer,
  suggestColumnMapping,
  TabularParseError,
} from "@/lib/tabular";

function excelBytes(rows: string[][]): Uint8Array {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Sheet1");
  return XLSX.write(book, { type: "array", bookType: "xlsx" }) as Uint8Array;
}

describe("tabular", () => {
  describe("parseCsvText", () => {
    it("parses simple CSV", () => {
      const matrix = parseCsvText("a,b\n1,2\n");
      expect(matrix).toEqual([
        ["a", "b"],
        ["1", "2"],
      ]);
    });

    it("handles quoted commas and doubled quotes", () => {
      const matrix = parseCsvText('name,notes\n"A, B","he said ""hi"""\n');
      expect(matrix).toEqual([
        ["name", "notes"],
        ["A, B", 'he said "hi"'],
      ]);
    });

    it("strips UTF-8 BOM", () => {
      const matrix = parseCsvText("\uFEFFname,phone\nRavi,98\n");
      expect(matrix[0]?.[0]).toBe("name");
    });
  });

  describe("parseTabularBuffer", () => {
    it("parses CSV bytes into headers and rows", () => {
      const csv = "name,phone\nRavi,9876543210\nMeera,9123456780\n";
      const sheet = parseTabularBuffer(
        new TextEncoder().encode(csv),
        "customers.csv",
      );
      expect(sheet.headers).toEqual(["name", "phone"]);
      expect(sheet.rows).toEqual([
        ["Ravi", "9876543210"],
        ["Meera", "9123456780"],
      ]);
    });

    it("rejects empty files", () => {
      expect(() =>
        parseTabularBuffer(new TextEncoder().encode(""), "empty.csv"),
      ).toThrow(TabularParseError);
    });

    it("parses Excel .xlsx into headers and rows", () => {
      const bytes = excelBytes([
        ["name", "phone"],
        ["Ravi", "9876543210"],
        ["Meera", "9123456780"],
      ]);
      const sheet = parseTabularBuffer(bytes, "customers.xlsx");
      expect(sheet.headers).toEqual(["name", "phone"]);
      expect(sheet.rows).toEqual([
        ["Ravi", "9876543210"],
        ["Meera", "9123456780"],
      ]);
    });

    it("rejects unsupported extensions", () => {
      expect(() =>
        parseTabularBuffer(new TextEncoder().encode("a,b\n1,2\n"), "notes.pdf"),
      ).toThrow(TabularParseError);
    });
  });

  describe("suggestColumnMapping", () => {
    it("matches aliases ignoring case and separators", () => {
      expect(
        suggestColumnMapping(
          ["Customer Name", "Mobile No"],
          ["name", "customername"],
        ),
      ).toBe(0);
      expect(
        suggestColumnMapping(["reg_no", "make"], ["registration", "regno"]),
      ).toBe(0);
    });
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCsvText } from "@/lib/tabular";
import { fieldsForEntity } from "@/modules/data-import/fields";
import { suggestColumnMapping } from "@/lib/tabular";

const samplesDir = join(process.cwd(), "public", "samples");

describe("import sample files", () => {
  it.each([
    ["customers", "customers-sample.csv"],
    ["vehicles", "vehicles-sample.csv"],
    ["parts", "parts-sample.csv"],
  ] as const)(
    "%s sample maps all required fields",
    (entity, filename) => {
      const text = readFileSync(join(samplesDir, filename), "utf8");
      const matrix = parseCsvText(text);
      const headers = matrix[0] ?? [];
      expect(headers.length).toBeGreaterThan(0);
      expect(matrix.length).toBeGreaterThan(1);

      for (const field of fieldsForEntity(entity)) {
        if (!field.required) continue;
        const index = suggestColumnMapping(headers, field.aliases);
        expect(index, `required field ${field.key}`).not.toBeNull();
      }
    },
  );
});

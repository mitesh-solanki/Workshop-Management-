import { z } from "zod";
import { fieldsForEntity } from "@/modules/data-import/fields";

export const IMPORT_ENTITIES = ["customers", "vehicles", "parts"] as const;
export type ImportEntity = (typeof IMPORT_ENTITIES)[number];

export const IMPORT_MODES = ["all_or_nothing", "skip_invalid"] as const;
export type ImportMode = (typeof IMPORT_MODES)[number];

export const importEntitySchema = z.enum(IMPORT_ENTITIES);
export const importModeSchema = z.enum(IMPORT_MODES);

/** Map field key → column index in the file (or null / omitted = unmapped). */
export const columnMappingSchema = z.record(
  z.string(),
  z.union([z.number().int().nonnegative(), z.null()]),
);

export const rawImportRowsSchema = z
  .array(z.array(z.string().max(4000)))
  .min(1)
  .max(1000);

export const validateImportInputSchema = z.object({
  entity: importEntitySchema,
  headers: z.array(z.string().max(200)).min(1).max(50),
  rows: rawImportRowsSchema,
  mapping: columnMappingSchema,
});

export const commitImportInputSchema = validateImportInputSchema.extend({
  mode: importModeSchema,
});

export type ValidateImportInput = z.infer<typeof validateImportInputSchema>;
export type CommitImportInput = z.infer<typeof commitImportInputSchema>;
export type ColumnMapping = z.infer<typeof columnMappingSchema>;

/** Serializable validation result for the import wizard UI. */
export type ImportValidationView = {
  entity: ImportEntity;
  headers: string[];
  rows: string[][];
  mapping: Record<string, number | null>;
  validCount: number;
  errorCount: number;
  totalCount: number;
  errors: Array<{
    rowNumber: number;
    field: string | null;
    code: string;
    message: string;
  }>;
  preview: Array<{
    rowNumber: number;
    status: "valid" | "invalid";
    cells: string[];
    errors: Array<{
      rowNumber: number;
      field: string | null;
      code: string;
      message: string;
    }>;
  }>;
  errorReportRows: Array<Record<string, string>>;
};

/** Ensure every required field for the entity is mapped to a column. */
export function assertRequiredFieldsMapped(
  entity: ImportEntity,
  mapping: ColumnMapping,
): string[] {
  const missing: string[] = [];
  for (const field of fieldsForEntity(entity)) {
    if (!field.required) {
      continue;
    }
    const index = mapping[field.key];
    if (index == null || !Number.isInteger(index)) {
      missing.push(field.key);
    }
  }
  return missing;
}

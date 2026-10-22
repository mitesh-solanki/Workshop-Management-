import "server-only";

import { AppError } from "@/lib/errors";
import { requireRole, type RoleSession } from "@/lib/rbac";
import {
  parseTabularBuffer,
  suggestColumnMapping,
  TabularParseError,
} from "@/lib/tabular";
import { fieldsForEntity } from "@/modules/data-import/fields";
import {
  assertRequiredFieldsMapped,
  commitImportInputSchema,
  type CommitImportInput,
  type ImportEntity,
  type ImportValidationView,
  type ValidateImportInput,
  validateImportInputSchema,
} from "@/modules/data-import/schema";
import {
  importCustomersBatch,
  importPartsBatch,
  importVehiclesBatch,
  listCustomerPhoneIndex,
  listRegistrationSet,
  listSkuSet,
} from "@/modules/data-import/repo";
import {
  buildErrorReportRows,
  validateImportRows,
  type RowValidationError,
  type ValidateRowsResult,
} from "@/modules/data-import/validate";

const WRITE_ROLES = ["OWNER", "MANAGER"] as const;

function rethrowParse(error: unknown): never {
  if (error instanceof TabularParseError) {
    throw new AppError(error.code, 400);
  }
  throw error;
}

export function buildSuggestedMapping(
  entity: ImportEntity,
  headers: string[],
): Record<string, number | null> {
  const mapping: Record<string, number | null> = {};
  for (const field of fieldsForEntity(entity)) {
    mapping[field.key] = suggestColumnMapping(headers, field.aliases);
  }
  return mapping;
}

export async function parseImportFile(
  session: RoleSession,
  raw: { buffer: ArrayBuffer | Buffer | Uint8Array; filename: string; entity: ImportEntity },
) {
  requireRole(session, WRITE_ROLES);

  let sheet;
  try {
    sheet = parseTabularBuffer(raw.buffer, raw.filename);
  } catch (error) {
    rethrowParse(error);
  }

  return {
    entity: raw.entity,
    filename: raw.filename,
    headers: sheet.headers,
    rows: sheet.rows,
    rowCount: sheet.rows.length,
    suggestedMapping: buildSuggestedMapping(raw.entity, sheet.headers),
  };
}

async function loadValidationContext(
  garageId: string,
  entity: ImportEntity,
) {
  if (entity === "vehicles") {
    const [customerIdByPhone, existingRegistrations] = await Promise.all([
      listCustomerPhoneIndex(garageId),
      listRegistrationSet(garageId),
    ]);
    return { customerIdByPhone, existingRegistrations };
  }
  if (entity === "parts") {
    return { existingSkus: await listSkuSet(garageId) };
  }
  return {};
}

export type { ImportValidationView };

function toValidationView(
  input: ValidateImportInput,
  result: ValidateRowsResult,
): ImportValidationView {
  const errorByRow = new Map<number, RowValidationError[]>();
  for (const err of result.errors) {
    const list = errorByRow.get(err.rowNumber) ?? [];
    list.push(err);
    errorByRow.set(err.rowNumber, list);
  }

  const validRowNumbers = new Set(result.valid.map((r) => r.rowNumber));
  const preview: ImportValidationView["preview"] = [];

  for (let i = 0; i < input.rows.length && preview.length < 20; i += 1) {
    const rowNumber = i + 2;
    const rowErrors = errorByRow.get(rowNumber) ?? [];
    const status = validRowNumbers.has(rowNumber) ? "valid" : "invalid";
    if (status === "invalid" || preview.length < 10) {
      preview.push({
        rowNumber,
        status,
        cells: input.rows[i] ?? [],
        errors: rowErrors,
      });
    }
  }

  return {
    entity: input.entity,
    headers: input.headers,
    rows: input.rows,
    mapping: input.mapping,
    validCount: result.valid.length,
    errorCount: errorByRow.size,
    totalCount: input.rows.length,
    errors: result.errors,
    preview,
    errorReportRows: buildErrorReportRows(
      input.headers,
      input.rows,
      result.errors,
    ),
  };
}

export async function validateImport(
  session: RoleSession,
  raw: ValidateImportInput,
): Promise<ImportValidationView> {
  requireRole(session, WRITE_ROLES);
  const input = validateImportInputSchema.parse(raw);

  const missing = assertRequiredFieldsMapped(input.entity, input.mapping);
  if (missing.length > 0) {
    throw new AppError("import.mapping_incomplete", 400, {
      fields: missing.join(", "),
    });
  }

  const context = await loadValidationContext(
    session.garageId,
    input.entity,
  );
  const result = validateImportRows(
    input.entity,
    input.rows,
    input.mapping,
    context,
  );
  return toValidationView(input, result);
}

export async function commitImport(
  session: RoleSession,
  raw: CommitImportInput,
) {
  requireRole(session, WRITE_ROLES);
  const input = commitImportInputSchema.parse(raw);

  const missing = assertRequiredFieldsMapped(input.entity, input.mapping);
  if (missing.length > 0) {
    throw new AppError("import.mapping_incomplete", 400, {
      fields: missing.join(", "),
    });
  }

  const context = await loadValidationContext(
    session.garageId,
    input.entity,
  );
  const result = validateImportRows(
    input.entity,
    input.rows,
    input.mapping,
    context,
  );

  if (input.mode === "all_or_nothing" && result.errors.length > 0) {
    throw new AppError("import.has_invalid_rows", 400, {
      errorCount: result.errors.length,
      validCount: result.valid.length,
    });
  }

  if (result.valid.length === 0) {
    throw new AppError("import.no_valid_rows", 400);
  }

  if (result.entity === "customers") {
    const batch = await importCustomersBatch(
      session.garageId,
      session.userId,
      result.valid,
    );
    return {
      entity: "customers" as const,
      importedCount: batch.importedCount,
      skippedCount: input.rows.length - batch.importedCount,
      mode: input.mode,
    };
  }

  if (result.entity === "vehicles") {
    const batch = await importVehiclesBatch(
      session.garageId,
      session.userId,
      result.valid,
    );
    return {
      entity: "vehicles" as const,
      importedCount: batch.importedCount,
      skippedCount: input.rows.length - batch.importedCount,
      mode: input.mode,
    };
  }

  const batch = await importPartsBatch(
    session.garageId,
    session.userId,
    result.valid,
  );
  return {
    entity: "parts" as const,
    importedCount: batch.importedCount,
    skippedCount: input.rows.length - batch.importedCount,
    mode: input.mode,
  };
}

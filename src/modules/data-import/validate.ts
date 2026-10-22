import { createCustomerSchema } from "@/modules/customers/schema";
import { fieldsForEntity } from "@/modules/data-import/fields";
import type {
  ColumnMapping,
  ImportEntity,
} from "@/modules/data-import/schema";
import { createPartSchema } from "@/modules/inventory/schema";
import {
  createVehicleSchema,
  normaliseRegistration,
} from "@/modules/vehicles/schema";

export type RowValidationError = {
  rowNumber: number;
  field: string | null;
  code: string;
  message: string;
};

export type ValidatedCustomerRow = {
  rowNumber: number;
  name: string;
  phone: string;
  address: string | null;
  notes: string | null;
};

export type ValidatedVehicleRow = {
  rowNumber: number;
  customerPhone: string;
  customerId: string;
  registrationNumber: string;
  make: string;
  model: string;
  year: number | null;
  odometer: number | null;
  insuranceExpiry: Date | null;
  pucExpiry: Date | null;
  fitnessExpiry: Date | null;
};

export type ValidatedPartRow = {
  rowNumber: number;
  name: string;
  sku: string;
  unit: string;
  purchasePricePaise: number;
  sellingPricePaise: number;
  gstRatePercent: number;
  hsn: string;
  lowStockLevel: number;
  openingStock: number;
};

export type ValidateRowsContext = {
  /** Normalised phone → customer id (vehicles). */
  customerIdByPhone?: Map<string, string>;
  /** Existing registrations in garage (uppercase, no spaces). */
  existingRegistrations?: Set<string>;
  /** Existing SKUs in garage (uppercase). */
  existingSkus?: Set<string>;
};

export type ValidateRowsResult =
  | {
      entity: "customers";
      valid: ValidatedCustomerRow[];
      errors: RowValidationError[];
    }
  | {
      entity: "vehicles";
      valid: ValidatedVehicleRow[];
      errors: RowValidationError[];
    }
  | {
      entity: "parts";
      valid: ValidatedPartRow[];
      errors: RowValidationError[];
    };

export function normalisePhoneKey(phone: string): string {
  return phone.replace(/\s+/g, "").trim();
}

function mappedRecord(
  entity: ImportEntity,
  row: readonly string[],
  mapping: ColumnMapping,
): Record<string, string> {
  const record: Record<string, string> = {};
  for (const field of fieldsForEntity(entity)) {
    const index = mapping[field.key];
    if (index == null) {
      record[field.key] = "";
      continue;
    }
    record[field.key] = row[index] ?? "";
  }
  return record;
}

function zodIssuesToErrors(
  rowNumber: number,
  issues: { path: PropertyKey[]; message: string }[],
): RowValidationError[] {
  return issues.map((issue) => {
    const field =
      issue.path.length > 0 ? String(issue.path[0]) : null;
    return {
      rowNumber,
      field,
      code: "import.row_invalid",
      message: issue.message,
    };
  });
}

function pushError(
  errors: RowValidationError[],
  rowNumber: number,
  field: string | null,
  code: string,
  message: string,
) {
  errors.push({ rowNumber, field, code, message });
}

export function validateImportRows(
  entity: ImportEntity,
  rows: readonly string[][],
  mapping: ColumnMapping,
  context: ValidateRowsContext = {},
): ValidateRowsResult {
  if (entity === "customers") {
    return validateCustomers(rows, mapping);
  }
  if (entity === "vehicles") {
    return validateVehicles(rows, mapping, context);
  }
  return validateParts(rows, mapping, context);
}

function validateCustomers(
  rows: readonly string[][],
  mapping: ColumnMapping,
): Extract<ValidateRowsResult, { entity: "customers" }> {
  const errors: RowValidationError[] = [];
  const valid: ValidatedCustomerRow[] = [];
  const phonesInFile = new Map<string, number>();

  rows.forEach((row, index) => {
    const rowNumber = index + 2; // 1-based file row including header
    const raw = mappedRecord("customers", row, mapping);
    const parsed = createCustomerSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push(...zodIssuesToErrors(rowNumber, parsed.error.issues));
      return;
    }

    const phoneKey = normalisePhoneKey(parsed.data.phone);
    const prior = phonesInFile.get(phoneKey);
    if (prior != null) {
      pushError(
        errors,
        rowNumber,
        "phone",
        "import.duplicate_in_file",
        `Duplicate phone (same as row ${prior})`,
      );
      return;
    }
    phonesInFile.set(phoneKey, rowNumber);
    valid.push({ rowNumber, ...parsed.data });
  });

  return { entity: "customers", valid, errors };
}

function validateVehicles(
  rows: readonly string[][],
  mapping: ColumnMapping,
  context: ValidateRowsContext,
): Extract<ValidateRowsResult, { entity: "vehicles" }> {
  const errors: RowValidationError[] = [];
  const valid: ValidatedVehicleRow[] = [];
  const regsInFile = new Map<string, number>();
  const phoneMap = context.customerIdByPhone ?? new Map();
  const existingRegs = context.existingRegistrations ?? new Set();

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const raw = mappedRecord("vehicles", row, mapping);
    const phoneKey = normalisePhoneKey(raw.customerPhone ?? "");
    const customerId = phoneMap.get(phoneKey);

    if (!phoneKey) {
      pushError(
        errors,
        rowNumber,
        "customerPhone",
        "import.row_invalid",
        "Customer phone is required",
      );
      return;
    }
    if (!customerId) {
      pushError(
        errors,
        rowNumber,
        "customerPhone",
        "import.customer_not_found",
        "No customer with this phone in the garage",
      );
      return;
    }

    const parsed = createVehicleSchema.safeParse({
      customerId,
      registrationNumber: raw.registrationNumber,
      make: raw.make,
      model: raw.model,
      year: raw.year || null,
      odometer: raw.odometer || null,
      insuranceExpiry: raw.insuranceExpiry || null,
      pucExpiry: raw.pucExpiry || null,
      fitnessExpiry: raw.fitnessExpiry || null,
    });

    if (!parsed.success) {
      errors.push(...zodIssuesToErrors(rowNumber, parsed.error.issues));
      return;
    }

    const reg = parsed.data.registrationNumber;
    const prior = regsInFile.get(reg);
    if (prior != null) {
      pushError(
        errors,
        rowNumber,
        "registrationNumber",
        "import.duplicate_in_file",
        `Duplicate registration (same as row ${prior})`,
      );
      return;
    }
    if (existingRegs.has(reg)) {
      pushError(
        errors,
        rowNumber,
        "registrationNumber",
        "import.registration_exists",
        "Registration already exists in this garage",
      );
      return;
    }

    regsInFile.set(reg, rowNumber);
    valid.push({
      rowNumber,
      customerPhone: phoneKey,
      customerId: parsed.data.customerId,
      registrationNumber: reg,
      make: parsed.data.make,
      model: parsed.data.model,
      year: parsed.data.year,
      odometer: parsed.data.odometer,
      insuranceExpiry: parsed.data.insuranceExpiry,
      pucExpiry: parsed.data.pucExpiry,
      fitnessExpiry: parsed.data.fitnessExpiry,
    });
  });

  return { entity: "vehicles", valid, errors };
}

function validateParts(
  rows: readonly string[][],
  mapping: ColumnMapping,
  context: ValidateRowsContext,
): Extract<ValidateRowsResult, { entity: "parts" }> {
  const errors: RowValidationError[] = [];
  const valid: ValidatedPartRow[] = [];
  const skusInFile = new Map<string, number>();
  const existingSkus = context.existingSkus ?? new Set();

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const raw = mappedRecord("parts", row, mapping);

    const parsed = createPartSchema.safeParse({
      name: raw.name,
      sku: raw.sku,
      unit: raw.unit,
      purchasePricePaise: raw.purchasePrice,
      sellingPricePaise: raw.sellingPrice,
      gstRatePercent: raw.gstRatePercent,
      hsn: raw.hsn,
      lowStockLevel: raw.lowStockLevel,
      openingStock: raw.openingStock || 0,
    });

    if (!parsed.success) {
      errors.push(...zodIssuesToErrors(rowNumber, parsed.error.issues));
      return;
    }

    const sku = parsed.data.sku;
    const prior = skusInFile.get(sku);
    if (prior != null) {
      pushError(
        errors,
        rowNumber,
        "sku",
        "import.duplicate_in_file",
        `Duplicate SKU (same as row ${prior})`,
      );
      return;
    }
    if (existingSkus.has(sku)) {
      pushError(
        errors,
        rowNumber,
        "sku",
        "import.sku_exists",
        "SKU already exists in this garage",
      );
      return;
    }

    skusInFile.set(sku, rowNumber);
    valid.push({
      rowNumber,
      name: parsed.data.name,
      sku,
      unit: parsed.data.unit,
      purchasePricePaise: parsed.data.purchasePricePaise,
      sellingPricePaise: parsed.data.sellingPricePaise,
      gstRatePercent: parsed.data.gstRatePercent,
      hsn: parsed.data.hsn,
      lowStockLevel: parsed.data.lowStockLevel,
      openingStock: parsed.data.openingStock,
    });
  });

  return { entity: "parts", valid, errors };
}

/** Build error-report rows for CSV download (includes original cells). */
export function buildErrorReportRows(
  headers: readonly string[],
  rows: readonly string[][],
  errors: readonly RowValidationError[],
): Array<Record<string, string>> {
  const byRow = new Map<number, RowValidationError[]>();
  for (const err of errors) {
    const list = byRow.get(err.rowNumber) ?? [];
    list.push(err);
    byRow.set(err.rowNumber, list);
  }

  const report: Array<Record<string, string>> = [];
  for (const [rowNumber, rowErrors] of [...byRow.entries()].sort(
    (a, b) => a[0] - b[0],
  )) {
    const dataIndex = rowNumber - 2;
    const cells = rows[dataIndex] ?? [];
    const record: Record<string, string> = {
      rowNumber: String(rowNumber),
      errors: rowErrors
        .map((e) =>
          e.field ? `${e.field}: ${e.message}` : e.message,
        )
        .join("; "),
    };
    headers.forEach((header, i) => {
      const key = header || `column_${i + 1}`;
      record[key] = cells[i] ?? "";
    });
    report.push(record);
  }
  return report;
}

export function registrationKey(value: string): string {
  return normaliseRegistration(value);
}

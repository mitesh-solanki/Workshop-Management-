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
  /** Set when this phone already belongs to a customer in the garage (update path). */
  existingCustomerId: string | null;
};

export type ValidatedVehicleRow = {
  rowNumber: number;
  customerPhone: string;
  /** Existing customer in the garage, if the phone already matched. */
  customerId: string | null;
  /** Create this customer on import when phone is new. */
  customerCreate: {
    name: string;
    phone: string;
    address: string | null;
    notes: string | null;
  } | null;
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
  /** Set when this SKU already belongs to a part in the garage (update path). */
  existingPartId: string | null;
};

export type ValidateRowsContext = {
  /** Normalised phone → customer id (customers + vehicles). */
  customerIdByPhone?: Map<string, string>;
  /** Existing registrations in garage (uppercase, no spaces). */
  existingRegistrations?: Set<string>;
  /** Existing SKU (uppercase) → part id. */
  partIdBySku?: Map<string, string>;
  /**
   * Customers: how to treat a phone that already exists in the garage.
   * - `error` — validation error (default; preview + all-or-nothing / skip)
   * - `update` — valid row with `existingCustomerId` set (update_existing mode)
   */
  existingCustomerPolicy?: "error" | "update";
  /**
   * Parts: how to treat a SKU that already exists in the garage.
   * - `error` — validation error (default; preview + all-or-nothing / skip)
   * - `update` — valid row with `existingPartId` set (update_existing mode)
   */
  existingPartPolicy?: "error" | "update";
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

const VALIDATION_MESSAGE_KEY = /^validation\.[a-zA-Z0-9_.]+$/;

function zodIssuesToErrors(
  rowNumber: number,
  issues: { path: PropertyKey[]; message: string }[],
): RowValidationError[] {
  return issues.map((issue) => {
    const field =
      issue.path.length > 0 ? String(issue.path[0]) : null;
    const code = VALIDATION_MESSAGE_KEY.test(issue.message)
      ? issue.message
      : "import.row_invalid";
    return {
      rowNumber,
      field,
      code,
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
    return validateCustomers(rows, mapping, context);
  }
  if (entity === "vehicles") {
    return validateVehicles(rows, mapping, context);
  }
  return validateParts(rows, mapping, context);
}

function validateCustomers(
  rows: readonly string[][],
  mapping: ColumnMapping,
  context: ValidateRowsContext,
): Extract<ValidateRowsResult, { entity: "customers" }> {
  const errors: RowValidationError[] = [];
  const valid: ValidatedCustomerRow[] = [];
  const phonesInFile = new Map<string, number>();
  const phoneMap = context.customerIdByPhone ?? new Map();
  const existingPolicy = context.existingCustomerPolicy ?? "error";

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
        "import.duplicate_phone_in_file",
        "import.duplicate_phone_in_file",
      );
      return;
    }
    phonesInFile.set(phoneKey, rowNumber);

    const existingCustomerId = phoneMap.get(phoneKey) ?? null;
    if (existingCustomerId) {
      if (existingPolicy === "error") {
        pushError(
          errors,
          rowNumber,
          "phone",
          "import.customer_exists",
          "import.customer_exists",
        );
        return;
      }
      valid.push({
        rowNumber,
        ...parsed.data,
        existingCustomerId,
      });
      return;
    }

    valid.push({
      rowNumber,
      ...parsed.data,
      existingCustomerId: null,
    });
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
  /** New phones in this file → first row that defined name/address. */
  const newCustomersInFile = new Map<
    string,
    { name: string; phone: string; address: string | null; notes: string | null }
  >();
  const phoneMap = context.customerIdByPhone ?? new Map();
  const existingRegs = context.existingRegistrations ?? new Set();

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const raw = mappedRecord("vehicles", row, mapping);
    const phoneKey = normalisePhoneKey(raw.customerPhone ?? "");
    const existingCustomerId = phoneMap.get(phoneKey);

    if (!phoneKey) {
      pushError(
        errors,
        rowNumber,
        "customerPhone",
        "import.customer_phone_required",
        "import.customer_phone_required",
      );
      return;
    }

    const customerId: string | null = existingCustomerId ?? null;
    let customerCreate: ValidatedVehicleRow["customerCreate"] = null;

    if (!customerId) {
      const alreadyQueued = newCustomersInFile.get(phoneKey);
      if (alreadyQueued) {
        customerCreate = alreadyQueued;
      } else {
        const customerParsed = createCustomerSchema.safeParse({
          name: raw.customerName ?? "",
          phone: raw.customerPhone ?? "",
          address: raw.customerAddress || null,
          notes: null,
        });
        if (!customerParsed.success) {
          const missingName = !(raw.customerName ?? "").trim();
          if (missingName) {
            pushError(
              errors,
              rowNumber,
              "customerName",
              "import.customer_name_required",
              "import.customer_name_required",
            );
          } else {
            errors.push(
              ...zodIssuesToErrors(rowNumber, customerParsed.error.issues),
            );
          }
          return;
        }
        customerCreate = {
          name: customerParsed.data.name,
          phone: customerParsed.data.phone,
          address: customerParsed.data.address,
          notes: customerParsed.data.notes,
        };
        newCustomersInFile.set(phoneKey, customerCreate);
      }
    }

    const parsed = createVehicleSchema.safeParse({
      customerId: customerId ?? "pending-create",
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
        "import.duplicate_registration_in_file",
        "import.duplicate_registration_in_file",
      );
      return;
    }
    if (existingRegs.has(reg)) {
      pushError(
        errors,
        rowNumber,
        "registrationNumber",
        "import.registration_exists",
        "import.registration_exists",
      );
      return;
    }

    regsInFile.set(reg, rowNumber);
    valid.push({
      rowNumber,
      customerPhone: phoneKey,
      customerId,
      customerCreate,
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
  const partIdBySku = context.partIdBySku ?? new Map();
  const existingPolicy = context.existingPartPolicy ?? "error";

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
        "import.duplicate_sku_in_file",
        "import.duplicate_sku_in_file",
      );
      return;
    }
    skusInFile.set(sku, rowNumber);

    const existingPartId = partIdBySku.get(sku) ?? null;
    if (existingPartId) {
      if (existingPolicy === "error") {
        pushError(
          errors,
          rowNumber,
          "sku",
          "import.sku_exists",
          "import.sku_exists",
        );
        return;
      }
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
        openingStock: 0,
        existingPartId,
      });
      return;
    }

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
      existingPartId: null,
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

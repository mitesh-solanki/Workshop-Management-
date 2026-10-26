"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { translateError } from "@/lib/translate-error";
import {
  IMPORT_ENTITIES,
  type ImportEntity,
  type ImportMode,
} from "@/modules/data-import/schema";
import type { ImportValidationView } from "@/modules/data-import/schema";
import {
  commitImport,
  parseImportFile,
  validateImport,
} from "@/modules/data-import/service";

function isEntity(value: unknown): value is ImportEntity {
  return (
    typeof value === "string" &&
    (IMPORT_ENTITIES as readonly string[]).includes(value)
  );
}

export type ParseImportResult =
  | {
      ok: true;
      entity: ImportEntity;
      filename: string;
      headers: string[];
      rows: string[][];
      rowCount: number;
      suggestedMapping: Record<string, number | null>;
    }
  | { ok: false; message: string };

export async function parseImportFileAction(
  formData: FormData,
): Promise<ParseImportResult> {
  try {
    const session = await requireSession();
    const entityRaw = formData.get("entity");
    const file = formData.get("file");

    if (!isEntity(entityRaw)) {
      throw new AppError("import.invalid_entity", 400);
    }
    if (!(file instanceof File) || file.size === 0) {
      throw new AppError("import.empty_file", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseImportFile(session, {
      buffer,
      filename: file.name || "upload.csv",
      entity: entityRaw,
    });

    return { ok: true, ...parsed };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

export type ValidateImportResult =
  | { ok: true; validation: ImportValidationView }
  | { ok: false; message: string };

export async function validateImportAction(payload: {
  entity: ImportEntity;
  headers: string[];
  rows: string[][];
  mapping: Record<string, number | null>;
}): Promise<ValidateImportResult> {
  try {
    const session = await requireSession();
    const validation = await validateImport(session, payload);
    return { ok: true, validation };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

export type CommitImportResult =
  | {
      ok: true;
      entity: ImportEntity;
      importedCount: number;
      skippedCount: number;
      mode: ImportMode;
      createdCount?: number;
      updatedCount?: number;
    }
  | { ok: false; message: string };

export async function commitImportAction(payload: {
  entity: ImportEntity;
  headers: string[];
  rows: string[][];
  mapping: Record<string, number | null>;
  mode: ImportMode;
}): Promise<CommitImportResult> {
  try {
    const session = await requireSession();
    const result = await commitImport(session, payload);

    revalidatePath("/customers");
    revalidatePath("/vehicles");
    revalidatePath("/inventory");
    revalidatePath("/customers/import");
    revalidatePath("/vehicles/import");
    revalidatePath("/inventory/import");

    return { ok: true, ...result };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

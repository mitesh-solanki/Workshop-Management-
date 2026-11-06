"use server";

import { translateError } from "@/lib/translate-error";
import { requireSession } from "@/lib/session";
import { buildGstExportFile } from "@/modules/invoices/service";

export async function exportGstInvoicesAction(input: {
  yearMonth: string;
  invoiceIds: string[];
}): Promise<
  | { ok: true; filename: string; csv: string; count: number }
  | { ok: false; message: string }
> {
  try {
    const session = await requireSession();
    const result = await buildGstExportFile(session, input);
    return {
      ok: true,
      filename: result.filename,
      csv: result.csv,
      count: result.count,
    };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

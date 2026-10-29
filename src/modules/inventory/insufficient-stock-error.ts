import { AppError } from "@/lib/errors";

/** User-facing insufficient stock error; include part name / id when known. */
export function insufficientStockError(
  partName?: string | null,
  partId?: string | null,
) {
  const name = partName?.trim();
  const id = partId?.trim();
  const params: Record<string, string> = {};
  if (name) params.partName = name;
  if (id) params.partId = id;
  return new AppError(
    "inventory.insufficient_stock",
    409,
    Object.keys(params).length > 0 ? params : undefined,
  );
}

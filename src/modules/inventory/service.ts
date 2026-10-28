import "server-only";

import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { requireRole, type RoleSession } from "@/lib/rbac";
import {
  DEFAULT_GST_RATE_PERCENT,
  DEFAULT_PART_HSN,
  createDirectSaleSchema,
  createPartByNameSchema,
  createPartSchema,
  deletePartSchema,
  partPickerPageSchema,
  partSearchSchema,
  stockAdjustSchema,
  stockInSchema,
  stockOutSchema,
  updatePartSchema,
  type CreateDirectSaleInput,
  type CreatePartByNameInput,
  type CreatePartInput,
  type StockAdjustInput,
  type StockInInput,
  type StockOutInput,
  type UpdatePartInput,
} from "@/modules/inventory/schema";
import {
  applyStockMovement,
  countPartLinkedRecords,
  createDirectSale as createDirectSaleRepo,
  createPart,
  deleteDirectSale as deleteDirectSaleRepo,
  deletePartById,
  DirectSaleTxError,
  updateDirectSale as updateDirectSaleRepo,
  findDirectSaleById,
  findPartById,
  findPartBySku,
  listDirectSales,
  listLowStockParts,
  listPartMovements,
  searchInStockPartsPage,
  searchParts,
  searchPartsCatalogPage,
  updatePart,
} from "@/modules/inventory/repo";
import { skuFromPartName } from "@/modules/inventory/sku-from-name";

const READ_ROLES = ["OWNER", "MANAGER", "ACCOUNTANT"] as const;
/** Job-card item picker — technicians may browse parts, not manage stock pages. */
const PICKER_ROLES = ["OWNER", "MANAGER", "ACCOUNTANT", "TECHNICIAN"] as const;
/** Name-only part create from the job-card picker. */
const NAME_CREATE_ROLES = ["OWNER", "MANAGER", "TECHNICIAN"] as const;
const WRITE_ROLES = ["OWNER", "MANAGER"] as const;
const SALE_ROLES = ["OWNER", "MANAGER", "ACCOUNTANT"] as const;

async function allocateUniqueSku(
  garageId: string,
  name: string,
): Promise<string> {
  const base = skuFromPartName(name) || "PART";
  for (let i = 0; i < 50; i += 1) {
    const suffix = i === 0 ? "" : `-${i + 1}`;
    const candidate = `${base.slice(0, Math.max(1, 64 - suffix.length))}${suffix}`;
    const existing = await findPartBySku(garageId, candidate);
    if (!existing) {
      return candidate;
    }
  }
  const fallback = `PART-${Date.now().toString(36).toUpperCase()}`.slice(0, 64);
  return fallback;
}

function mapStockFailure(
  reason: "PART_NOT_FOUND" | "INSUFFICIENT_STOCK",
): never {
  if (reason === "PART_NOT_FOUND") {
    throw new NotFoundError();
  }
  throw new AppError("inventory.insufficient_stock", 409);
}

export async function listParts(
  session: RoleSession,
  raw: { q?: string; sort?: string; inStockOnly?: boolean } = {},
) {
  requireRole(session, READ_ROLES);
  const { inStockOnly = false, ...search } = raw;
  const input = partSearchSchema.parse(search);
  const parts = await searchParts(session.garageId, input.q, input.sort);
  if (!inStockOnly) {
    return parts;
  }
  return parts.filter((part) => part.quantityOnHand > 0);
}

export async function listPartsForPickerPage(
  session: RoleSession,
  raw: { q?: string; offset?: number; pageSize?: number } = {},
) {
  requireRole(session, PICKER_ROLES);
  const input = partPickerPageSchema.parse(raw);
  return searchInStockPartsPage(
    session.garageId,
    input.q,
    input.offset,
    input.pageSize,
  );
}

/** All parts matching search (including zero stock). Empty query = browse page. */
export async function listPartsForCatalogSearchPage(
  session: RoleSession,
  raw: { q?: string; offset?: number; pageSize?: number } = {},
) {
  requireRole(session, PICKER_ROLES);
  const input = partPickerPageSchema.parse(raw);
  return searchPartsCatalogPage(
    session.garageId,
    input.q,
    input.offset,
    input.pageSize,
  );
}

export async function getPart(session: RoleSession, partId: string) {
  requireRole(session, READ_ROLES);
  const part = await findPartById(session.garageId, partId);
  if (!part) {
    throw new NotFoundError();
  }
  return part;
}

/** Picker summary for job cards — technicians allowed; prices zeroed for them. */
export async function getPartForPicker(session: RoleSession, partId: string) {
  requireRole(session, PICKER_ROLES);
  const part = await findPartById(session.garageId, partId);
  if (!part) {
    throw new NotFoundError();
  }
  const hidePrices = session.role === "TECHNICIAN";
  return {
    id: part.id,
    name: part.name,
    sku: part.sku,
    unit: part.unit,
    sellingPricePaise: hidePrices ? 0 : part.sellingPricePaise,
    quantityOnHand: part.quantityOnHand,
  };
}

export async function getPartHistory(session: RoleSession, partId: string) {
  const part = await getPart(session, partId);
  const movements = await listPartMovements(session.garageId, part.id);
  return { part, movements };
}

export async function getLowStockAlerts(session: RoleSession) {
  requireRole(session, READ_ROLES);
  return listLowStockParts(session.garageId);
}

export async function createPartRecord(
  session: RoleSession,
  raw: CreatePartInput,
) {
  requireRole(session, WRITE_ROLES);
  const input = createPartSchema.parse(raw);

  const existing = await findPartBySku(session.garageId, input.sku);
  if (existing) {
    throw new AppError("inventory.sku_exists", 409);
  }

  return createPart(session.garageId, {
    name: input.name,
    sku: input.sku,
    unit: input.unit,
    purchasePricePaise: input.purchasePricePaise,
    sellingPricePaise: input.sellingPricePaise,
    gstRatePercent: input.gstRatePercent,
    hsn: input.hsn,
    lowStockLevel: input.lowStockLevel,
    openingStock: input.openingStock,
    actorId: session.userId,
  });
}

/**
 * Name-only catalogue row for job cards (technician-friendly).
 * No prices, stock, or bills — owner fills those later.
 */
export async function createPartByNameRecord(
  session: RoleSession,
  raw: CreatePartByNameInput,
) {
  requireRole(session, NAME_CREATE_ROLES);
  const input = createPartByNameSchema.parse(raw);
  const sku = await allocateUniqueSku(session.garageId, input.name);

  return createPart(session.garageId, {
    name: input.name,
    sku,
    unit: "pcs",
    purchasePricePaise: 0,
    sellingPricePaise: 0,
    gstRatePercent: DEFAULT_GST_RATE_PERCENT,
    hsn: DEFAULT_PART_HSN,
    lowStockLevel: 0,
    openingStock: 0,
    actorId: session.userId,
  });
}

export async function updatePartRecord(
  session: RoleSession,
  partId: string,
  raw: UpdatePartInput,
) {
  requireRole(session, WRITE_ROLES);
  const input = updatePartSchema.parse(raw);

  const existing = await findPartBySku(session.garageId, input.sku);
  if (existing && existing.id !== partId) {
    throw new AppError("inventory.sku_exists", 409);
  }

  const part = await updatePart(session.garageId, partId, {
    name: input.name,
    sku: input.sku,
    unit: input.unit,
    purchasePricePaise: input.purchasePricePaise,
    sellingPricePaise: input.sellingPricePaise,
    gstRatePercent: input.gstRatePercent,
    hsn: input.hsn,
    lowStockLevel: input.lowStockLevel,
    actorId: session.userId,
  });

  if (!part) {
    throw new NotFoundError();
  }
  return part;
}

export async function deletePartRecord(
  session: RoleSession,
  partId: string,
) {
  requireRole(session, WRITE_ROLES);
  const { partId: id } = deletePartSchema.parse({ partId });

  const part = await findPartById(session.garageId, id);
  if (!part) {
    throw new NotFoundError();
  }

  const linked = await countPartLinkedRecords(session.garageId, id);
  if (linked > 0) {
    throw new AppError("inventory.part_in_use", 409);
  }

  const deleted = await deletePartById(session.garageId, id, {
    actorId: session.userId,
    name: part.name,
    sku: part.sku,
  });

  if (!deleted) {
    throw new NotFoundError();
  }

  return deleted;
}

export async function recordStockIn(
  session: RoleSession,
  raw: StockInInput,
) {
  requireRole(session, WRITE_ROLES);
  const input = stockInSchema.parse(raw);

  const result = await applyStockMovement(session.garageId, {
    partId: input.partId,
    type: "IN",
    quantity: input.quantity,
    note: input.note,
    actorId: session.userId,
  });

  if (!result.ok) {
    mapStockFailure(result.reason);
  }
  return result;
}

export async function recordStockOut(
  session: RoleSession,
  raw: StockOutInput,
) {
  requireRole(session, WRITE_ROLES);
  const input = stockOutSchema.parse(raw);

  const result = await applyStockMovement(session.garageId, {
    partId: input.partId,
    type: "OUT",
    quantity: input.quantity,
    note: input.note,
    actorId: session.userId,
  });

  if (!result.ok) {
    mapStockFailure(result.reason);
  }
  return result;
}

export async function recordStockAdjustment(
  session: RoleSession,
  raw: StockAdjustInput,
) {
  requireRole(session, WRITE_ROLES);
  const input = stockAdjustSchema.parse(raw);

  const result = await applyStockMovement(session.garageId, {
    partId: input.partId,
    type: "ADJUSTMENT",
    quantity: input.quantityChange,
    note: input.note,
    actorId: session.userId,
  });

  if (!result.ok) {
    mapStockFailure(result.reason);
  }
  return result;
}

export async function createDirectSaleRecord(
  session: RoleSession,
  raw: CreateDirectSaleInput,
) {
  requireRole(session, SALE_ROLES);
  const input = createDirectSaleSchema.parse(raw);

  // Resolve catalogue prices/HSN from parts so clients cannot invent GST rows.
  const lines = [];
  for (const line of input.lines) {
    const part = await findPartById(session.garageId, line.partId);
    if (!part) {
      throw new NotFoundError();
    }
    lines.push({
      partId: part.id,
      quantity: line.quantity,
      unitPricePaise: line.unitPricePaise,
      gstRatePercent: part.gstRatePercent,
      hsn: part.hsn,
    });
  }

  try {
    return await createDirectSaleRepo(session.garageId, {
      customerId: input.customerId,
      walkInName: input.walkInName,
      notes: input.notes,
      actorId: session.userId,
      lines,
    });
  } catch (error) {
    if (error instanceof DirectSaleTxError) {
      if (error.reason === "CUSTOMER_NOT_FOUND") {
        throw new NotFoundError();
      }
      if (
        error.reason === "PART_NOT_FOUND" ||
        error.reason === "INSUFFICIENT_STOCK"
      ) {
        mapStockFailure(error.reason);
      }
    }
    throw error;
  }
}

export async function listSales(session: RoleSession) {
  requireRole(session, SALE_ROLES);
  return listDirectSales(session.garageId);
}

export async function getSale(session: RoleSession, saleId: string) {
  requireRole(session, SALE_ROLES);
  const sale = await findDirectSaleById(session.garageId, saleId);
  if (!sale) {
    throw new NotFoundError();
  }
  return sale;
}

export async function updateDirectSaleRecord(
  session: RoleSession,
  raw: CreateDirectSaleInput & { saleId: string },
) {
  requireRole(session, SALE_ROLES);
  const saleId = String(raw.saleId ?? "").trim();
  if (!saleId) {
    throw new NotFoundError();
  }
  const input = createDirectSaleSchema.parse(raw);

  const lines = [];
  for (const line of input.lines) {
    const part = await findPartById(session.garageId, line.partId);
    if (!part) {
      throw new NotFoundError();
    }
    lines.push({
      partId: part.id,
      quantity: line.quantity,
      unitPricePaise: line.unitPricePaise,
      gstRatePercent: part.gstRatePercent,
      hsn: part.hsn,
    });
  }

  try {
    return await updateDirectSaleRepo(session.garageId, {
      saleId,
      customerId: input.customerId,
      walkInName: input.walkInName,
      notes: input.notes,
      actorId: session.userId,
      lines,
    });
  } catch (error) {
    if (error instanceof DirectSaleTxError) {
      if (
        error.reason === "SALE_NOT_FOUND" ||
        error.reason === "CUSTOMER_NOT_FOUND"
      ) {
        throw new NotFoundError();
      }
      if (
        error.reason === "PART_NOT_FOUND" ||
        error.reason === "INSUFFICIENT_STOCK"
      ) {
        mapStockFailure(error.reason);
      }
    }
    throw error;
  }
}

export async function deleteDirectSaleRecord(
  session: RoleSession,
  saleId: string,
) {
  requireRole(session, SALE_ROLES);
  try {
    return await deleteDirectSaleRepo(
      session.garageId,
      saleId,
      session.userId,
    );
  } catch (error) {
    if (error instanceof DirectSaleTxError) {
      if (error.reason === "SALE_NOT_FOUND") {
        throw new NotFoundError();
      }
      if (
        error.reason === "PART_NOT_FOUND" ||
        error.reason === "INSUFFICIENT_STOCK"
      ) {
        mapStockFailure(error.reason);
      }
    }
    throw error;
  }
}

/** Test helper: attempt cross-garage part read. */
export async function getPartForGarageId(
  session: RoleSession,
  requestedGarageId: string,
  partId: string,
) {
  if (requestedGarageId !== session.garageId) {
    throw new ForbiddenError();
  }
  return getPart(session, partId);
}

import "server-only";

import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { requireRole, type RoleSession } from "@/lib/rbac";
import {
  createDirectSaleSchema,
  createPartSchema,
  partSearchSchema,
  stockAdjustSchema,
  stockInSchema,
  stockOutSchema,
  updatePartSchema,
  type CreateDirectSaleInput,
  type CreatePartInput,
  type StockAdjustInput,
  type StockInInput,
  type StockOutInput,
  type UpdatePartInput,
} from "@/modules/inventory/schema";
import {
  applyStockMovement,
  createDirectSale as createDirectSaleRepo,
  createPart,
  DirectSaleTxError,
  findDirectSaleById,
  findPartById,
  findPartBySku,
  listDirectSales,
  listLowStockParts,
  listPartMovements,
  searchParts,
  updatePart,
} from "@/modules/inventory/repo";

const READ_ROLES = ["OWNER", "MANAGER", "TECHNICIAN", "ACCOUNTANT"] as const;
const WRITE_ROLES = ["OWNER", "MANAGER"] as const;
const SALE_ROLES = ["OWNER", "MANAGER", "ACCOUNTANT"] as const;

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
  raw: { q?: string } = {},
) {
  requireRole(session, READ_ROLES);
  const input = partSearchSchema.parse(raw);
  return searchParts(session.garageId, input.q);
}

export async function getPart(session: RoleSession, partId: string) {
  requireRole(session, READ_ROLES);
  const part = await findPartById(session.garageId, partId);
  if (!part) {
    throw new NotFoundError();
  }
  return part;
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
      notes: input.notes,
      actorId: session.userId,
      lines,
    });
  } catch (error) {
    if (error instanceof DirectSaleTxError) {
      if (error.reason === "CUSTOMER_NOT_FOUND") {
        throw new NotFoundError();
      }
      mapStockFailure(error.reason);
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

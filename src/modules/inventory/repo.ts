import "server-only";

import type { Prisma, StockMovementType } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  assertStockChangeAllowed,
  quantityChangeForMovement,
} from "@/modules/inventory/stock";

export type DbClient = Prisma.TransactionClient | typeof prisma;

const partSelect = {
  id: true,
  garageId: true,
  name: true,
  sku: true,
  unit: true,
  purchasePricePaise: true,
  sellingPricePaise: true,
  gstRatePercent: true,
  hsn: true,
  lowStockLevel: true,
  createdAt: true,
  updatedAt: true,
} as const;

const movementSelect = {
  id: true,
  garageId: true,
  partId: true,
  type: true,
  quantityChange: true,
  note: true,
  serviceOrderId: true,
  serviceOrderLineId: true,
  directSaleId: true,
  directSaleLineId: true,
  createdById: true,
  createdAt: true,
} as const;

export async function findGarageStockSettings(
  garageId: string,
  db: DbClient = prisma,
) {
  return db.garage.findFirst({
    where: { id: garageId },
    select: { id: true, allowNegativeStock: true },
  });
}

function partOrderBy(
  sort: "newest" | "updated" | "name_asc" | "name_desc",
) {
  if (sort === "newest") {
    return [{ createdAt: "desc" as const }, { name: "asc" as const }];
  }
  if (sort === "updated") {
    return [{ updatedAt: "desc" as const }, { name: "asc" as const }];
  }
  if (sort === "name_desc") {
    return [{ name: "desc" as const }, { sku: "asc" as const }];
  }
  return [{ name: "asc" as const }, { sku: "asc" as const }];
}

export async function searchParts(
  garageId: string,
  q: string,
  sort: "newest" | "updated" | "name_asc" | "name_desc" = "name_asc",
) {
  const query = q.trim();
  const parts = await prisma.part.findMany({
    where: {
      garageId,
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { sku: { contains: query, mode: "insensitive" } },
              { hsn: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: partSelect,
    orderBy: partOrderBy(sort),
    take: 200,
  });

  // Case-insensitive A–Z / Z–A for display (Postgres name order is case-sensitive).
  const ordered =
    sort === "name_asc" || sort === "name_desc"
      ? [...parts].sort((a, b) => {
          const cmp = a.name.localeCompare(b.name, undefined, {
            sensitivity: "base",
          });
          if (cmp !== 0) {
            return sort === "name_desc" ? -cmp : cmp;
          }
          return (a.sku ?? "").localeCompare(b.sku ?? "", undefined, {
            sensitivity: "base",
          });
        })
      : parts;

  const stocks = await getStockLevelsForParts(
    garageId,
    ordered.map((p) => p.id),
  );

  return ordered.map((part) => ({
    ...part,
    quantityOnHand: stocks.get(part.id) ?? 0,
  }));
}

export async function findPartById(garageId: string, partId: string) {
  const part = await prisma.part.findFirst({
    where: { id: partId, garageId },
    select: partSelect,
  });
  if (!part) {
    return null;
  }
  const quantityOnHand = await getPartStock(garageId, partId);
  return { ...part, quantityOnHand };
}

export async function findPartBySku(garageId: string, sku: string) {
  return prisma.part.findFirst({
    where: { garageId, sku },
    select: { id: true },
  });
}

export async function listPartMovements(
  garageId: string,
  partId: string,
  take = 50,
) {
  return prisma.stockMovement.findMany({
    where: { garageId, partId },
    select: {
      ...movementSelect,
      createdBy: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take,
  });
}

/** Sum of signed quantityChange for one part (no lock). */
export async function getPartStock(
  garageId: string,
  partId: string,
  db: DbClient = prisma,
): Promise<number> {
  const agg = await db.stockMovement.aggregate({
    where: { garageId, partId },
    _sum: { quantityChange: true },
  });
  return agg._sum.quantityChange ?? 0;
}

export async function getStockLevelsForParts(
  garageId: string,
  partIds: string[],
  db: DbClient = prisma,
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (partIds.length === 0) {
    return map;
  }

  const grouped = await db.stockMovement.groupBy({
    by: ["partId"],
    where: { garageId, partId: { in: partIds } },
    _sum: { quantityChange: true },
  });

  for (const id of partIds) {
    map.set(id, 0);
  }
  for (const row of grouped) {
    map.set(row.partId, row._sum.quantityChange ?? 0);
  }
  return map;
}

/**
 * Lock the Part row (FOR UPDATE) then return derived stock.
 * Must be called inside a transaction.
 */
export async function lockPartAndGetStock(
  tx: Prisma.TransactionClient,
  garageId: string,
  partId: string,
): Promise<{ partId: string; quantityOnHand: number } | null> {
  const locked = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "Part"
    WHERE id = ${partId} AND "garageId" = ${garageId}
    FOR UPDATE
  `;
  if (locked.length === 0) {
    return null;
  }
  const quantityOnHand = await getPartStock(garageId, partId, tx);
  return { partId, quantityOnHand };
}

export async function listLowStockParts(garageId: string) {
  const parts = await prisma.part.findMany({
    where: { garageId },
    select: partSelect,
    orderBy: [{ name: "asc" }],
    take: 500,
  });
  const stocks = await getStockLevelsForParts(
    garageId,
    parts.map((p) => p.id),
  );
  return parts
    .map((part) => ({
      ...part,
      quantityOnHand: stocks.get(part.id) ?? 0,
    }))
    .filter((part) => part.quantityOnHand <= part.lowStockLevel)
    .sort((a, b) => a.quantityOnHand - b.quantityOnHand)
    .slice(0, 50);
}

export async function createPart(
  garageId: string,
  data: {
    name: string;
    sku: string;
    unit: string;
    purchasePricePaise: number;
    sellingPricePaise: number;
    gstRatePercent: number;
    hsn: string;
    lowStockLevel: number;
    openingStock: number;
    actorId: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    const part = await tx.part.create({
      data: {
        garageId,
        name: data.name,
        sku: data.sku,
        unit: data.unit,
        purchasePricePaise: data.purchasePricePaise,
        sellingPricePaise: data.sellingPricePaise,
        gstRatePercent: data.gstRatePercent,
        hsn: data.hsn,
        lowStockLevel: data.lowStockLevel,
      },
      select: partSelect,
    });

    if (data.openingStock > 0) {
      await tx.stockMovement.create({
        data: {
          garageId,
          partId: part.id,
          type: "IN",
          quantityChange: data.openingStock,
          note: "Opening stock",
          createdById: data.actorId,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        garageId,
        actorId: data.actorId,
        action: "inventory.part_created",
        entity: "Part",
        entityId: part.id,
        meta: {
          name: part.name,
          sku: part.sku,
          openingStock: data.openingStock,
        } satisfies Prisma.InputJsonValue,
      },
    });

    return {
      ...part,
      quantityOnHand: data.openingStock,
    };
  });
}

export async function updatePart(
  garageId: string,
  partId: string,
  data: {
    name: string;
    sku: string;
    unit: string;
    purchasePricePaise: number;
    sellingPricePaise: number;
    gstRatePercent: number;
    hsn: string;
    lowStockLevel: number;
    actorId: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    const result = await tx.part.updateMany({
      where: { id: partId, garageId },
      data: {
        name: data.name,
        sku: data.sku,
        unit: data.unit,
        purchasePricePaise: data.purchasePricePaise,
        sellingPricePaise: data.sellingPricePaise,
        gstRatePercent: data.gstRatePercent,
        hsn: data.hsn,
        lowStockLevel: data.lowStockLevel,
      },
    });
    if (result.count === 0) {
      return null;
    }

    await tx.auditLog.create({
      data: {
        garageId,
        actorId: data.actorId,
        action: "inventory.part_updated",
        entity: "Part",
        entityId: partId,
        meta: {
          name: data.name,
          sku: data.sku,
        } satisfies Prisma.InputJsonValue,
      },
    });

    const part = await tx.part.findFirst({
      where: { id: partId, garageId },
      select: partSelect,
    });
    if (!part) {
      return null;
    }
    const quantityOnHand = await getPartStock(garageId, partId, tx);
    return { ...part, quantityOnHand };
  });
}

export type StockMutationResult =
  | {
      ok: true;
      movement: {
        id: string;
        type: StockMovementType;
        quantityChange: number;
        partId: string;
      };
      resultingStock: number;
    }
  | { ok: false; reason: "PART_NOT_FOUND" | "INSUFFICIENT_STOCK"; resultingStock?: number };

/**
 * Append a stock movement under a Part row lock. Rejects negative resulting
 * stock unless the garage allows it. Safe under concurrent OUT attempts.
 */
export async function applyStockMovement(
  garageId: string,
  data: {
    partId: string;
    type: StockMovementType;
    /** Absolute positive qty for IN/OUT; signed delta for ADJUSTMENT. */
    quantity: number;
    note: string | null;
    actorId: string;
    serviceOrderId?: string | null;
    serviceOrderLineId?: string | null;
    directSaleId?: string | null;
    directSaleLineId?: string | null;
    goodsReceiptLineId?: string | null;
    purchaseReturnId?: string | null;
  },
  /** Optional outer transaction (e.g. service-order line + stock out). */
  outerTx?: Prisma.TransactionClient,
): Promise<StockMutationResult> {
  const run = async (tx: Prisma.TransactionClient): Promise<StockMutationResult> => {
    const locked = await lockPartAndGetStock(tx, garageId, data.partId);
    if (!locked) {
      return { ok: false, reason: "PART_NOT_FOUND" };
    }

    const garage = await findGarageStockSettings(garageId, tx);
    const allowNegativeStock = garage?.allowNegativeStock ?? false;

    const quantityChange =
      data.type === "ADJUSTMENT"
        ? data.quantity
        : quantityChangeForMovement(data.type, data.quantity);

    const check = assertStockChangeAllowed({
      currentStock: locked.quantityOnHand,
      quantityChange,
      allowNegativeStock,
    });
    if (!check.ok) {
      return {
        ok: false,
        reason: "INSUFFICIENT_STOCK",
        resultingStock: check.resultingStock,
      };
    }

    const movement = await tx.stockMovement.create({
      data: {
        garageId,
        partId: data.partId,
        type: data.type,
        quantityChange,
        note: data.note,
        serviceOrderId: data.serviceOrderId ?? null,
        serviceOrderLineId: data.serviceOrderLineId ?? null,
        directSaleId: data.directSaleId ?? null,
        directSaleLineId: data.directSaleLineId ?? null,
        goodsReceiptLineId: data.goodsReceiptLineId ?? null,
        purchaseReturnId: data.purchaseReturnId ?? null,
        createdById: data.actorId,
      },
      select: {
        id: true,
        type: true,
        quantityChange: true,
        partId: true,
      },
    });

    await tx.auditLog.create({
      data: {
        garageId,
        actorId: data.actorId,
        action: "inventory.stock_movement",
        entity: "StockMovement",
        entityId: movement.id,
        meta: {
          partId: data.partId,
          type: data.type,
          quantityChange,
          resultingStock: check.resultingStock,
          serviceOrderId: data.serviceOrderId ?? null,
          directSaleId: data.directSaleId ?? null,
          goodsReceiptLineId: data.goodsReceiptLineId ?? null,
          purchaseReturnId: data.purchaseReturnId ?? null,
        } satisfies Prisma.InputJsonValue,
      },
    });

    return {
      ok: true,
      movement,
      resultingStock: check.resultingStock,
    };
  };

  if (outerTx) {
    return run(outerTx);
  }
  return prisma.$transaction(run);
}

export class DirectSaleTxError extends Error {
  readonly reason:
    | "PART_NOT_FOUND"
    | "INSUFFICIENT_STOCK"
    | "CUSTOMER_NOT_FOUND"
    | "SALE_NOT_FOUND";
  readonly partId?: string;

  constructor(
    reason:
      | "PART_NOT_FOUND"
      | "INSUFFICIENT_STOCK"
      | "CUSTOMER_NOT_FOUND"
      | "SALE_NOT_FOUND",
    partId?: string,
  ) {
    super(reason);
    this.name = "DirectSaleTxError";
    this.reason = reason;
    this.partId = partId;
  }
}

export async function createDirectSale(
  garageId: string,
  data: {
    customerId: string | null;
    walkInName: string | null;
    notes: string | null;
    actorId: string;
    lines: Array<{
      partId: string;
      quantity: number;
      unitPricePaise: number;
      gstRatePercent: number;
      hsn: string;
    }>;
  },
): Promise<{ saleId: string }> {
  try {
    return await prisma.$transaction(async (tx) => {
      if (data.customerId) {
        const customer = await tx.customer.findFirst({
          where: { id: data.customerId, garageId },
          select: { id: true },
        });
        if (!customer) {
          throw new DirectSaleTxError("CUSTOMER_NOT_FOUND");
        }
      }

      const sale = await tx.directSale.create({
        data: {
          garageId,
          customerId: data.customerId,
          walkInName: data.customerId ? null : data.walkInName,
          notes: data.notes,
          createdById: data.actorId,
        },
        select: { id: true },
      });

      for (let i = 0; i < data.lines.length; i += 1) {
        const lineInput = data.lines[i]!;
        const part = await tx.part.findFirst({
          where: { id: lineInput.partId, garageId },
          select: {
            id: true,
            gstRatePercent: true,
            hsn: true,
            sellingPricePaise: true,
          },
        });
        if (!part) {
          throw new DirectSaleTxError("PART_NOT_FOUND", lineInput.partId);
        }

        const line = await tx.directSaleLine.create({
          data: {
            garageId,
            directSaleId: sale.id,
            partId: part.id,
            quantity: lineInput.quantity,
            unitPricePaise: lineInput.unitPricePaise,
            gstRatePercent: lineInput.gstRatePercent,
            hsn: lineInput.hsn,
            sortOrder: i,
          },
          select: { id: true },
        });

        const stock = await applyStockMovement(
          garageId,
          {
            partId: part.id,
            type: "OUT",
            quantity: lineInput.quantity,
            note: "Direct sale",
            actorId: data.actorId,
            directSaleId: sale.id,
            directSaleLineId: line.id,
          },
          tx,
        );

        if (!stock.ok) {
          throw new DirectSaleTxError(stock.reason, part.id);
        }
      }

      await tx.auditLog.create({
        data: {
          garageId,
          actorId: data.actorId,
          action: "inventory.direct_sale_created",
          entity: "DirectSale",
          entityId: sale.id,
          meta: {
            lineCount: data.lines.length,
            customerId: data.customerId,
            walkInName: data.walkInName,
          } satisfies Prisma.InputJsonValue,
        },
      });

      return { saleId: sale.id };
    });
  } catch (error) {
    if (error instanceof DirectSaleTxError) {
      throw error;
    }
    throw error;
  }
}

export async function updateDirectSale(
  garageId: string,
  data: {
    saleId: string;
    customerId: string | null;
    walkInName: string | null;
    notes: string | null;
    actorId: string;
    lines: Array<{
      partId: string;
      quantity: number;
      unitPricePaise: number;
      gstRatePercent: number;
      hsn: string;
    }>;
  },
): Promise<{ saleId: string }> {
  return prisma.$transaction(async (tx) => {
    const sale = await tx.directSale.findFirst({
      where: { id: data.saleId, garageId },
      select: {
        id: true,
        lines: {
          select: { id: true, partId: true, quantity: true },
        },
      },
    });
    if (!sale) {
      throw new DirectSaleTxError("SALE_NOT_FOUND");
    }

    if (data.customerId) {
      const customer = await tx.customer.findFirst({
        where: { id: data.customerId, garageId },
        select: { id: true },
      });
      if (!customer) {
        throw new DirectSaleTxError("CUSTOMER_NOT_FOUND");
      }
    }

    for (const line of sale.lines) {
      const stock = await applyStockMovement(
        garageId,
        {
          partId: line.partId,
          type: "IN",
          quantity: line.quantity,
          note: "Edit counter sale (restore)",
          actorId: data.actorId,
          directSaleId: sale.id,
          directSaleLineId: line.id,
        },
        tx,
      );
      if (!stock.ok) {
        throw new DirectSaleTxError(stock.reason, line.partId);
      }
    }

    await tx.directSaleLine.deleteMany({
      where: { directSaleId: sale.id, garageId },
    });

    await tx.directSale.update({
      where: { id: sale.id },
      data: {
        customerId: data.customerId,
        walkInName: data.customerId ? null : data.walkInName,
        notes: data.notes,
      },
    });

    for (let i = 0; i < data.lines.length; i += 1) {
      const lineInput = data.lines[i]!;
      const part = await tx.part.findFirst({
        where: { id: lineInput.partId, garageId },
        select: { id: true },
      });
      if (!part) {
        throw new DirectSaleTxError("PART_NOT_FOUND", lineInput.partId);
      }

      const line = await tx.directSaleLine.create({
        data: {
          garageId,
          directSaleId: sale.id,
          partId: part.id,
          quantity: lineInput.quantity,
          unitPricePaise: lineInput.unitPricePaise,
          gstRatePercent: lineInput.gstRatePercent,
          hsn: lineInput.hsn,
          sortOrder: i,
        },
        select: { id: true },
      });

      const stock = await applyStockMovement(
        garageId,
        {
          partId: part.id,
          type: "OUT",
          quantity: lineInput.quantity,
          note: "Direct sale",
          actorId: data.actorId,
          directSaleId: sale.id,
          directSaleLineId: line.id,
        },
        tx,
      );
      if (!stock.ok) {
        throw new DirectSaleTxError(stock.reason, part.id);
      }
    }

    await tx.auditLog.create({
      data: {
        garageId,
        actorId: data.actorId,
        action: "inventory.direct_sale_updated",
        entity: "DirectSale",
        entityId: sale.id,
        meta: {
          lineCount: data.lines.length,
          customerId: data.customerId,
          walkInName: data.walkInName,
        } satisfies Prisma.InputJsonValue,
      },
    });

    return { saleId: sale.id };
  });
}

export async function deleteDirectSale(
  garageId: string,
  saleId: string,
  actorId: string,
) {
  return prisma.$transaction(async (tx) => {
    const sale = await tx.directSale.findFirst({
      where: { id: saleId, garageId },
      select: {
        id: true,
        lines: {
          select: { id: true, partId: true, quantity: true },
        },
      },
    });
    if (!sale) {
      throw new DirectSaleTxError("SALE_NOT_FOUND");
    }

    for (const line of sale.lines) {
      const stock = await applyStockMovement(
        garageId,
        {
          partId: line.partId,
          type: "IN",
          quantity: line.quantity,
          note: "Void counter sale",
          actorId,
          directSaleId: sale.id,
          directSaleLineId: line.id,
        },
        tx,
      );
      if (!stock.ok) {
        throw new DirectSaleTxError(stock.reason, line.partId);
      }
    }

    await tx.directSale.delete({ where: { id: sale.id } });

    await tx.auditLog.create({
      data: {
        garageId,
        actorId,
        action: "inventory.direct_sale_deleted",
        entity: "DirectSale",
        entityId: sale.id,
        meta: {
          lineCount: sale.lines.length,
        } satisfies Prisma.InputJsonValue,
      },
    });

    return { saleId: sale.id };
  });
}

export async function findDirectSaleById(garageId: string, saleId: string) {
  return prisma.directSale.findFirst({
    where: { id: saleId, garageId },
    select: {
      id: true,
      garageId: true,
      customerId: true,
      walkInName: true,
      notes: true,
      createdAt: true,
      customer: {
        select: { id: true, name: true, phone: true },
      },
      createdBy: {
        select: { id: true, name: true, email: true },
      },
      lines: {
        select: {
          id: true,
          partId: true,
          quantity: true,
          unitPricePaise: true,
          gstRatePercent: true,
          hsn: true,
          sortOrder: true,
          part: {
            select: { id: true, name: true, sku: true, unit: true },
          },
        },
        orderBy: [{ sortOrder: "asc" }],
      },
    },
  });
}

export async function listDirectSales(garageId: string) {
  return prisma.directSale.findMany({
    where: { garageId },
    select: {
      id: true,
      notes: true,
      walkInName: true,
      createdAt: true,
      customer: {
        select: { id: true, name: true, phone: true },
      },
      lines: {
        select: {
          id: true,
          quantity: true,
          unitPricePaise: true,
          gstRatePercent: true,
          hsn: true,
          part: { select: { id: true, name: true, sku: true, unit: true } },
        },
        orderBy: [{ sortOrder: "asc" }],
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

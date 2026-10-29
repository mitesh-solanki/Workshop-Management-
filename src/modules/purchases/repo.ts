import "server-only";

import type { PartsRequestStatus, Prisma, PurchaseOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { applyStockMovement } from "@/modules/inventory/repo";
import { billOutstandingPaise } from "@/modules/purchases/outstanding";
import { purchaseOrderStatusFromLines } from "@/modules/purchases/po-status";
import {
  purchaseOrderReceiptStockNote,
  purchaseReturnStockNote,
} from "@/modules/purchases/stock-notes";

export class PurchasesTxError extends Error {
  readonly code: string;
  readonly params?: Record<string, string | number>;

  constructor(code: string, params?: Record<string, string | number>) {
    super(code);
    this.name = "PurchasesTxError";
    this.code = code;
    this.params = params;
  }
}

export async function searchPartsRequests(
  garageId: string,
  q: string | undefined,
  status: string,
  sort: string,
  page: number,
  pageSize: number,
) {
  const where: Prisma.PartsRequestWhereInput = {
    garageId,
    ...(status !== "ALL"
      ? { status: status as PartsRequestStatus }
      : {}),
    ...(q
      ? {
          OR: [
            { part: { name: { contains: q, mode: "insensitive" } } },
            { part: { sku: { contains: q, mode: "insensitive" } } },
            { notes: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const orderBy: Prisma.PartsRequestOrderByWithRelationInput =
    sort === "oldest"
      ? { createdAt: "asc" }
      : sort === "part_asc"
        ? { part: { name: "asc" } }
        : sort === "part_desc"
          ? { part: { name: "desc" } }
          : { createdAt: "desc" };

  const [total, items] = await Promise.all([
    prisma.partsRequest.count({ where }),
    prisma.partsRequest.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        part: {
          select: { id: true, name: true, sku: true, unit: true },
        },
        purchaseOrder: { select: { id: true, number: true } },
        serviceOrder: { select: { id: true } },
      },
    }),
  ]);

  return { items, total, page, pageSize };
}

export async function findPartsRequestById(garageId: string, id: string) {
  return prisma.partsRequest.findFirst({
    where: { id, garageId },
    include: {
      part: {
        select: {
          id: true,
          name: true,
          sku: true,
          unit: true,
          purchasePricePaise: true,
        },
      },
      purchaseOrder: { select: { id: true, number: true, status: true } },
      serviceOrder: { select: { id: true } },
      serviceOrderLine: { select: { id: true, description: true } },
    },
  });
}

export async function listOpenPartsRequests(garageId: string) {
  return prisma.partsRequest.findMany({
    where: { garageId, status: "OPEN" },
    orderBy: { createdAt: "asc" },
    include: {
      part: {
        select: {
          id: true,
          name: true,
          sku: true,
          unit: true,
          purchasePricePaise: true,
        },
      },
    },
  });
}

export async function listPartsRequestsForPart(garageId: string, partId: string) {
  return prisma.partsRequest.findMany({
    where: { garageId, partId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      purchaseOrder: {
        select: {
          id: true,
          number: true,
          vendor: { select: { id: true, name: true } },
        },
      },
      serviceOrder: { select: { id: true } },
    },
  });
}

export async function createPartsRequest(
  garageId: string,
  data: {
    partId: string;
    quantity: number;
    notes: string | null;
    serviceOrderId: string | null;
    serviceOrderLineId: string | null;
    actorId: string;
  },
) {
  const part = await prisma.part.findFirst({
    where: { id: data.partId, garageId },
    select: { id: true },
  });
  if (!part) {
    throw new PurchasesTxError("purchases.part_not_found");
  }

  if (data.serviceOrderLineId) {
    const line = await prisma.serviceOrderLine.findFirst({
      where: {
        id: data.serviceOrderLineId,
        garageId,
        type: "PART",
        partId: data.partId,
      },
      select: { id: true, serviceOrderId: true },
    });
    if (!line) {
      throw new PurchasesTxError("purchases.order_line_not_found");
    }
    data.serviceOrderId = line.serviceOrderId;
  } else if (data.serviceOrderId) {
    const order = await prisma.serviceOrder.findFirst({
      where: { id: data.serviceOrderId, garageId },
      select: { id: true },
    });
    if (!order) {
      throw new PurchasesTxError("purchases.order_not_found");
    }
  }

  return prisma.$transaction(async (tx) => {
    const request = await tx.partsRequest.create({
      data: {
        garageId,
        partId: data.partId,
        quantity: data.quantity,
        notes: data.notes,
        serviceOrderId: data.serviceOrderId,
        serviceOrderLineId: data.serviceOrderLineId,
        createdById: data.actorId,
      },
    });

    await tx.auditLog.create({
      data: {
        garageId,
        actorId: data.actorId,
        action: "purchases.parts_request_created",
        entity: "PartsRequest",
        entityId: request.id,
        meta: {
          partId: data.partId,
          quantity: data.quantity,
        },
      },
    });

    return request;
  });
}

export async function cancelPartsRequest(
  garageId: string,
  requestId: string,
  actorId: string,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.partsRequest.findFirst({
      where: { id: requestId, garageId },
      select: { id: true, status: true },
    });
    if (!existing) {
      throw new PurchasesTxError("purchases.request_not_found");
    }
    if (existing.status !== "OPEN") {
      throw new PurchasesTxError("purchases.request_not_open");
    }
    const result = await tx.partsRequest.updateMany({
      where: { id: requestId, garageId },
      data: { status: "CANCELLED" },
    });
    if (result.count === 0) {
      throw new PurchasesTxError("purchases.request_not_found");
    }
    const updated = await tx.partsRequest.findFirst({
      where: { id: requestId, garageId },
    });
    if (!updated) {
      throw new PurchasesTxError("purchases.request_not_found");
    }
    await tx.auditLog.create({
      data: {
        garageId,
        actorId,
        action: "purchases.parts_request_cancelled",
        entity: "PartsRequest",
        entityId: requestId,
      },
    });
    return updated;
  });
}

async function nextPurchaseOrderNumber(
  tx: Prisma.TransactionClient,
  garageId: string,
): Promise<string> {
  const counter = await tx.purchaseOrderNumberCounter.upsert({
    where: { garageId },
    create: { garageId, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
    select: { lastNumber: true },
  });
  return `PO-${String(counter.lastNumber).padStart(4, "0")}`;
}

export async function createPurchaseOrderFromRequests(
  garageId: string,
  data: {
    vendorId: string;
    notes: string | null;
    partsRequestIds: string[];
    actorId: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    const vendor = await tx.vendor.findFirst({
      where: { id: data.vendorId, garageId },
      select: { id: true },
    });
    if (!vendor) {
      throw new PurchasesTxError("purchases.vendor_not_found");
    }

    const requests = await tx.partsRequest.findMany({
      where: {
        garageId,
        id: { in: data.partsRequestIds },
        status: "OPEN",
      },
      include: {
        part: { select: { id: true, purchasePricePaise: true } },
      },
    });

    if (requests.length !== data.partsRequestIds.length) {
      throw new PurchasesTxError("purchases.requests_not_open");
    }

    const merged = new Map<
      string,
      { partId: string; quantity: number; unitCostPaise: number }
    >();
    for (const req of requests) {
      const prev = merged.get(req.partId);
      if (prev) {
        prev.quantity += req.quantity;
      } else {
        merged.set(req.partId, {
          partId: req.partId,
          quantity: req.quantity,
          unitCostPaise: req.part.purchasePricePaise,
        });
      }
    }

    const number = await nextPurchaseOrderNumber(tx, garageId);
    const po = await tx.purchaseOrder.create({
      data: {
        garageId,
        vendorId: data.vendorId,
        number,
        notes: data.notes,
        createdById: data.actorId,
        status: "PENDING",
        lines: {
          create: Array.from(merged.values()).map((line, index) => ({
            garageId,
            partId: line.partId,
            quantityOrdered: line.quantity,
            quantityReceived: 0,
            unitCostPaise: line.unitCostPaise,
            sortOrder: index,
          })),
        },
      },
      include: { lines: true },
    });

    await tx.partsRequest.updateMany({
      where: { id: { in: data.partsRequestIds }, garageId },
      data: { status: "ORDERED", purchaseOrderId: po.id },
    });

    await tx.auditLog.create({
      data: {
        garageId,
        actorId: data.actorId,
        action: "purchases.purchase_order_created",
        entity: "PurchaseOrder",
        entityId: po.id,
        meta: {
          vendorId: data.vendorId,
          number,
          requestIds: data.partsRequestIds,
        },
      },
    });

    return po;
  });
}

export async function searchPurchaseOrders(
  garageId: string,
  q: string | undefined,
  status: string,
  sort: string,
  page: number,
  pageSize: number,
) {
  const where: Prisma.PurchaseOrderWhereInput = {
    garageId,
    ...(status !== "ALL"
      ? { status: status as PurchaseOrderStatus }
      : {}),
    ...(q
      ? {
          OR: [
            { number: { contains: q, mode: "insensitive" } },
            { vendor: { name: { contains: q, mode: "insensitive" } } },
            { notes: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.purchaseOrder.count({ where }),
    prisma.purchaseOrder.findMany({
      where,
      orderBy: { createdAt: sort === "oldest" ? "asc" : "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        vendor: { select: { id: true, name: true } },
        lines: {
          select: { quantityOrdered: true, quantityReceived: true },
        },
      },
    }),
  ]);

  return { items, total, page, pageSize };
}

export async function findPurchaseOrderById(garageId: string, id: string) {
  return prisma.purchaseOrder.findFirst({
    where: { id, garageId },
    include: {
      vendor: {
        select: {
          id: true,
          name: true,
          phone: true,
          gstin: true,
        },
      },
      lines: {
        orderBy: { sortOrder: "asc" },
        include: {
          part: {
            select: { id: true, name: true, sku: true, unit: true },
          },
        },
      },
      partsRequests: {
        select: { id: true, quantity: true, partId: true },
      },
      goodsReceipts: {
        orderBy: { createdAt: "desc" },
        include: {
          lines: {
            select: {
              id: true,
              quantity: true,
              partId: true,
              purchaseOrderLineId: true,
            },
          },
        },
      },
    },
  });
}

export async function receiveAgainstPurchaseOrder(
  garageId: string,
  data: {
    purchaseOrderId: string;
    notes: string | null;
    lines: Array<{ purchaseOrderLineId: string; quantity: number }>;
    actorId: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findFirst({
      where: { id: data.purchaseOrderId, garageId },
      select: { id: true, number: true, status: true },
    });
    if (!po) {
      throw new PurchasesTxError("purchases.po_not_found");
    }
    if (po.status === "RECEIVED") {
      throw new PurchasesTxError("purchases.po_already_received");
    }

    const lockedLines = await tx.$queryRaw<
      Array<{
        id: string;
        partId: string;
        quantityOrdered: number;
        quantityReceived: number;
      }>
    >`
      SELECT id, "partId", "quantityOrdered", "quantityReceived"
      FROM "PurchaseOrderLine"
      WHERE "purchaseOrderId" = ${po.id} AND "garageId" = ${garageId}
      FOR UPDATE
    `;

    const lineMap = new Map(lockedLines.map((l) => [l.id, l]));
    const toReceive = data.lines.filter((l) => l.quantity > 0);
    if (toReceive.length === 0) {
      throw new PurchasesTxError("purchases.receive_qty_required");
    }

    for (const line of toReceive) {
      const poLine = lineMap.get(line.purchaseOrderLineId);
      if (!poLine) {
        throw new PurchasesTxError("purchases.po_line_not_found");
      }
      const remaining = poLine.quantityOrdered - poLine.quantityReceived;
      if (line.quantity > remaining) {
        throw new PurchasesTxError("purchases.receive_exceeds_ordered");
      }
    }

    const receipt = await tx.goodsReceipt.create({
      data: {
        garageId,
        purchaseOrderId: po.id,
        notes: data.notes,
        createdById: data.actorId,
      },
    });

    for (const line of toReceive) {
      const poLine = lineMap.get(line.purchaseOrderLineId)!;
      const receiptLine = await tx.goodsReceiptLine.create({
        data: {
          garageId,
          goodsReceiptId: receipt.id,
          purchaseOrderLineId: poLine.id,
          partId: poLine.partId,
          quantity: line.quantity,
        },
      });

      const stock = await applyStockMovement(
        garageId,
        {
          partId: poLine.partId,
          type: "IN",
          quantity: line.quantity,
          note: purchaseOrderReceiptStockNote(po.number),
          actorId: data.actorId,
          goodsReceiptLineId: receiptLine.id,
        },
        tx,
      );
      if (!stock.ok) {
        throw new PurchasesTxError("purchases.stock_failed");
      }

      const lineResult = await tx.purchaseOrderLine.updateMany({
        where: { id: poLine.id, garageId },
        data: {
          quantityReceived: { increment: line.quantity },
        },
      });
      if (lineResult.count === 0) {
        throw new PurchasesTxError("purchases.po_line_not_found");
      }
    }

    const refreshedLines = await tx.purchaseOrderLine.findMany({
      where: { purchaseOrderId: po.id, garageId },
      select: { quantityOrdered: true, quantityReceived: true },
    });
    const nextStatus = purchaseOrderStatusFromLines(refreshedLines);
    const poStatusResult = await tx.purchaseOrder.updateMany({
      where: { id: po.id, garageId },
      data: { status: nextStatus },
    });
    if (poStatusResult.count === 0) {
      throw new PurchasesTxError("purchases.po_not_found");
    }

    await tx.auditLog.create({
      data: {
        garageId,
        actorId: data.actorId,
        action: "purchases.goods_received",
        entity: "GoodsReceipt",
        entityId: receipt.id,
        meta: {
          purchaseOrderId: po.id,
          lines: toReceive,
          status: nextStatus,
        },
      },
    });

    return { receiptId: receipt.id, status: nextStatus };
  });
}

export async function searchVendorBills(
  garageId: string,
  q: string | undefined,
  sort: string,
  page: number,
  pageSize: number,
) {
  const where: Prisma.VendorBillWhereInput = {
    garageId,
    ...(q
      ? {
          OR: [
            { billNumber: { contains: q, mode: "insensitive" } },
            { vendor: { name: { contains: q, mode: "insensitive" } } },
            { notes: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.vendorBill.count({ where }),
    prisma.vendorBill.findMany({
      where,
      orderBy: { billDate: sort === "oldest" ? "asc" : "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        vendor: { select: { id: true, name: true } },
        payments: { select: { amountPaise: true } },
        returns: { select: { creditPaise: true } },
        purchaseOrder: { select: { id: true, number: true } },
      },
    }),
  ]);

  return {
    items: items.map((bill) => ({
      ...bill,
      outstandingPaise: billOutstandingPaise({
        amountPaise: bill.amountPaise,
        paymentsPaise: bill.payments.reduce((s, p) => s + p.amountPaise, 0),
        returnsCreditPaise: bill.returns.reduce((s, r) => s + r.creditPaise, 0),
      }),
    })),
    total,
    page,
    pageSize,
  };
}

export async function findVendorBillById(garageId: string, id: string) {
  const bill = await prisma.vendorBill.findFirst({
    where: { id, garageId },
    include: {
      vendor: {
        select: { id: true, name: true, phone: true, gstin: true },
      },
      purchaseOrder: { select: { id: true, number: true } },
      payments: { orderBy: { paidAt: "desc" } },
      returns: {
        orderBy: { createdAt: "desc" },
        include: {
          part: { select: { id: true, name: true, sku: true, unit: true } },
        },
      },
    },
  });
  if (!bill) return null;
  const paymentsPaise = bill.payments.reduce((s, p) => s + p.amountPaise, 0);
  const returnsCreditPaise = bill.returns.reduce((s, r) => s + r.creditPaise, 0);
  return {
    ...bill,
    paymentsPaise,
    returnsCreditPaise,
    outstandingPaise: billOutstandingPaise({
      amountPaise: bill.amountPaise,
      paymentsPaise,
      returnsCreditPaise,
    }),
  };
}

/** Attachment metadata for shop-receive Bought From download links. */
export async function findVendorBillAttachmentsByIds(
  garageId: string,
  ids: string[],
) {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (unique.length === 0) return [];
  return prisma.vendorBill.findMany({
    where: { garageId, id: { in: unique } },
    select: {
      id: true,
      attachmentStorageKey: true,
      attachmentFileName: true,
      attachmentContentType: true,
    },
  });
}

/**
 * Recent vendor bills for matching shop-receive stock-ins that predate the
 * bill-id marker in the movement note (match by createdAt proximity).
 */
export async function listRecentVendorBillsForShopReceiveMatch(
  garageId: string,
  take = 200,
) {
  return prisma.vendorBill.findMany({
    where: { garageId },
    select: {
      id: true,
      createdAt: true,
      attachmentStorageKey: true,
      attachmentFileName: true,
      attachmentContentType: true,
    },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function createVendorBill(
  garageId: string,
  data: {
    vendorId: string;
    purchaseOrderId: string | null;
    billNumber: string | null;
    billDate: Date;
    amountPaise: number;
    notes: string | null;
    actorId: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    const vendor = await tx.vendor.findFirst({
      where: { id: data.vendorId, garageId },
      select: { id: true },
    });
    if (!vendor) {
      throw new PurchasesTxError("purchases.vendor_not_found");
    }
    if (data.purchaseOrderId) {
      const po = await tx.purchaseOrder.findFirst({
        where: {
          id: data.purchaseOrderId,
          garageId,
          vendorId: data.vendorId,
        },
        select: { id: true },
      });
      if (!po) {
        throw new PurchasesTxError("purchases.po_not_found");
      }
    }

    const bill = await tx.vendorBill.create({
      data: {
        garageId,
        vendorId: data.vendorId,
        purchaseOrderId: data.purchaseOrderId,
        billNumber: data.billNumber,
        billDate: data.billDate,
        amountPaise: data.amountPaise,
        notes: data.notes,
        createdById: data.actorId,
      },
    });

    await tx.auditLog.create({
      data: {
        garageId,
        actorId: data.actorId,
        action: "purchases.vendor_bill_created",
        entity: "VendorBill",
        entityId: bill.id,
        meta: {
          vendorId: data.vendorId,
          amountPaise: data.amountPaise,
        },
      },
    });

    return bill;
  });
}

export async function setVendorBillAttachment(
  garageId: string,
  data: {
    vendorBillId: string;
    storageKey: string;
    contentType: string;
    fileName: string | null;
    byteSize: number;
    actorId: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.vendorBill.findFirst({
      where: { id: data.vendorBillId, garageId },
      select: {
        id: true,
        attachmentStorageKey: true,
      },
    });
    if (!existing) {
      throw new PurchasesTxError("purchases.bill_not_found");
    }

    const attachResult = await tx.vendorBill.updateMany({
      where: { id: existing.id, garageId },
      data: {
        attachmentStorageKey: data.storageKey,
        attachmentContentType: data.contentType,
        attachmentFileName: data.fileName,
        attachmentByteSize: data.byteSize,
      },
    });
    if (attachResult.count === 0) {
      throw new PurchasesTxError("purchases.bill_not_found");
    }
    const bill = await tx.vendorBill.findFirst({
      where: { id: existing.id, garageId },
    });
    if (!bill) {
      throw new PurchasesTxError("purchases.bill_not_found");
    }

    await tx.auditLog.create({
      data: {
        garageId,
        actorId: data.actorId,
        action: "purchases.vendor_bill_attachment",
        entity: "VendorBill",
        entityId: bill.id,
        meta: {
          contentType: data.contentType,
          byteSize: data.byteSize,
          replaced: Boolean(existing.attachmentStorageKey),
        },
      },
    });

    return {
      bill,
      previousStorageKey: existing.attachmentStorageKey,
    };
  });
}

export async function clearVendorBillAttachment(
  garageId: string,
  data: { vendorBillId: string; actorId: string },
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.vendorBill.findFirst({
      where: { id: data.vendorBillId, garageId },
      select: {
        id: true,
        attachmentStorageKey: true,
      },
    });
    if (!existing) {
      throw new PurchasesTxError("purchases.bill_not_found");
    }
    if (!existing.attachmentStorageKey) {
      return { bill: null, previousStorageKey: null as string | null };
    }

    const clearResult = await tx.vendorBill.updateMany({
      where: { id: existing.id, garageId },
      data: {
        attachmentStorageKey: null,
        attachmentContentType: null,
        attachmentFileName: null,
        attachmentByteSize: null,
      },
    });
    if (clearResult.count === 0) {
      throw new PurchasesTxError("purchases.bill_not_found");
    }
    const bill = await tx.vendorBill.findFirst({
      where: { id: existing.id, garageId },
    });
    if (!bill) {
      throw new PurchasesTxError("purchases.bill_not_found");
    }

    await tx.auditLog.create({
      data: {
        garageId,
        actorId: data.actorId,
        action: "purchases.vendor_bill_attachment_removed",
        entity: "VendorBill",
        entityId: bill.id,
        meta: {},
      },
    });

    return {
      bill,
      previousStorageKey: existing.attachmentStorageKey,
    };
  });
}

export async function recordVendorBillPayment(
  garageId: string,
  data: {
    vendorBillId: string;
    amountPaise: number;
    method: string;
    notes: string | null;
    actorId: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    const bill = await tx.vendorBill.findFirst({
      where: { id: data.vendorBillId, garageId },
      include: {
        payments: { select: { amountPaise: true } },
        returns: { select: { creditPaise: true } },
      },
    });
    if (!bill) {
      throw new PurchasesTxError("purchases.bill_not_found");
    }

    const outstanding = billOutstandingPaise({
      amountPaise: bill.amountPaise,
      paymentsPaise: bill.payments.reduce((s, p) => s + p.amountPaise, 0),
      returnsCreditPaise: bill.returns.reduce((s, r) => s + r.creditPaise, 0),
    });
    if (data.amountPaise > outstanding) {
      throw new PurchasesTxError("purchases.payment_exceeds_outstanding");
    }

    const payment = await tx.vendorBillPayment.create({
      data: {
        garageId,
        vendorBillId: bill.id,
        amountPaise: data.amountPaise,
        method: data.method,
        notes: data.notes,
        createdById: data.actorId,
      },
    });

    await tx.auditLog.create({
      data: {
        garageId,
        actorId: data.actorId,
        action: "purchases.vendor_bill_payment",
        entity: "VendorBillPayment",
        entityId: payment.id,
        meta: {
          vendorBillId: bill.id,
          amountPaise: data.amountPaise,
        },
      },
    });

    return payment;
  });
}

export async function searchPurchaseReturns(
  garageId: string,
  q: string | undefined,
  sort: string,
  page: number,
  pageSize: number,
) {
  const where: Prisma.PurchaseReturnWhereInput = {
    garageId,
    ...(q
      ? {
          OR: [
            { vendor: { name: { contains: q, mode: "insensitive" } } },
            { part: { name: { contains: q, mode: "insensitive" } } },
            { part: { sku: { contains: q, mode: "insensitive" } } },
            { notes: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.purchaseReturn.count({ where }),
    prisma.purchaseReturn.findMany({
      where,
      orderBy: { createdAt: sort === "oldest" ? "asc" : "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        vendor: { select: { id: true, name: true } },
        part: { select: { id: true, name: true, sku: true, unit: true } },
        vendorBill: { select: { id: true, billNumber: true } },
      },
    }),
  ]);

  return { items, total, page, pageSize };
}

export async function findPurchaseReturnById(garageId: string, id: string) {
  return prisma.purchaseReturn.findFirst({
    where: { id, garageId },
    include: {
      vendor: { select: { id: true, name: true } },
      part: { select: { id: true, name: true, sku: true, unit: true } },
      vendorBill: { select: { id: true, billNumber: true, amountPaise: true } },
    },
  });
}

export async function createPurchaseReturn(
  garageId: string,
  data: {
    vendorId: string;
    vendorBillId: string | null;
    partId: string;
    quantity: number;
    creditPaise: number;
    notes: string | null;
    actorId: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    const vendor = await tx.vendor.findFirst({
      where: { id: data.vendorId, garageId },
      select: { id: true },
    });
    if (!vendor) {
      throw new PurchasesTxError("purchases.vendor_not_found");
    }

    const part = await tx.part.findFirst({
      where: { id: data.partId, garageId },
      select: { id: true, name: true },
    });
    if (!part) {
      throw new PurchasesTxError("purchases.part_not_found");
    }

    if (data.vendorBillId) {
      const bill = await tx.vendorBill.findFirst({
        where: {
          id: data.vendorBillId,
          garageId,
          vendorId: data.vendorId,
        },
        include: {
          payments: { select: { amountPaise: true } },
          returns: { select: { creditPaise: true } },
        },
      });
      if (!bill) {
        throw new PurchasesTxError("purchases.bill_not_found");
      }
      const outstanding = billOutstandingPaise({
        amountPaise: bill.amountPaise,
        paymentsPaise: bill.payments.reduce((s, p) => s + p.amountPaise, 0),
        returnsCreditPaise: bill.returns.reduce((s, r) => s + r.creditPaise, 0),
      });
      if (data.creditPaise > outstanding) {
        throw new PurchasesTxError("purchases.return_credit_exceeds");
      }
    }

    const purchaseReturn = await tx.purchaseReturn.create({
      data: {
        garageId,
        vendorId: data.vendorId,
        vendorBillId: data.vendorBillId,
        partId: data.partId,
        quantity: data.quantity,
        creditPaise: data.creditPaise,
        notes: data.notes,
        createdById: data.actorId,
      },
    });

    const stock = await applyStockMovement(
      garageId,
      {
        partId: data.partId,
        type: "OUT",
        quantity: data.quantity,
        note: purchaseReturnStockNote(),
        actorId: data.actorId,
        purchaseReturnId: purchaseReturn.id,
      },
      tx,
    );
    if (!stock.ok) {
      if (stock.reason === "INSUFFICIENT_STOCK") {
        throw new PurchasesTxError("inventory.insufficient_stock", {
          partName: stock.partName ?? part.name,
          partId: stock.partId ?? part.id,
        });
      }
      throw new PurchasesTxError("purchases.stock_failed");
    }

    await tx.auditLog.create({
      data: {
        garageId,
        actorId: data.actorId,
        action: "purchases.purchase_return_created",
        entity: "PurchaseReturn",
        entityId: purchaseReturn.id,
        meta: {
          vendorId: data.vendorId,
          partId: data.partId,
          quantity: data.quantity,
          creditPaise: data.creditPaise,
        },
      },
    });

    return purchaseReturn;
  });
}

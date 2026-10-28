import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { VendorSort } from "@/modules/vendors/schema";
import { vendorOutstandingPaise } from "@/modules/purchases/outstanding";

function vendorOrderBy(
  sort: VendorSort,
): Prisma.VendorOrderByWithRelationInput {
  switch (sort) {
    case "name_asc":
      return { name: "asc" };
    case "name_desc":
      return { name: "desc" };
    case "oldest":
      return { createdAt: "asc" };
    case "newest":
    default:
      return { createdAt: "desc" };
  }
}

export async function searchVendors(
  garageId: string,
  q: string | undefined,
  page: number,
  pageSize: number,
  sort: VendorSort,
) {
  const where: Prisma.VendorWhereInput = {
    garageId,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
            { gstin: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.vendor.count({ where }),
    prisma.vendor.findMany({
      where,
      orderBy: vendorOrderBy(sort),
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        gstin: true,
        address: true,
        notes: true,
        createdAt: true,
      },
    }),
  ]);

  const withOutstanding = await Promise.all(
    items.map(async (vendor) => ({
      ...vendor,
      outstandingPaise: await getVendorOutstandingPaise(garageId, vendor.id),
    })),
  );

  return { items: withOutstanding, total, page, pageSize };
}

export async function getVendorOutstandingPaise(
  garageId: string,
  vendorId: string,
): Promise<number> {
  const [bills, payments, returns] = await Promise.all([
    prisma.vendorBill.aggregate({
      where: { garageId, vendorId },
      _sum: { amountPaise: true },
    }),
    prisma.vendorBillPayment.aggregate({
      where: { garageId, vendorBill: { vendorId } },
      _sum: { amountPaise: true },
    }),
    prisma.purchaseReturn.aggregate({
      where: { garageId, vendorId },
      _sum: { creditPaise: true },
    }),
  ]);

  return vendorOutstandingPaise({
    billsPaise: bills._sum.amountPaise ?? 0,
    paymentsPaise: payments._sum.amountPaise ?? 0,
    returnsCreditPaise: returns._sum.creditPaise ?? 0,
  });
}

export async function getGarageVendorOutstandingTotal(
  garageId: string,
): Promise<number> {
  const [bills, payments, returns] = await Promise.all([
    prisma.vendorBill.aggregate({
      where: { garageId },
      _sum: { amountPaise: true },
    }),
    prisma.vendorBillPayment.aggregate({
      where: { garageId },
      _sum: { amountPaise: true },
    }),
    prisma.purchaseReturn.aggregate({
      where: { garageId },
      _sum: { creditPaise: true },
    }),
  ]);

  return vendorOutstandingPaise({
    billsPaise: bills._sum.amountPaise ?? 0,
    paymentsPaise: payments._sum.amountPaise ?? 0,
    returnsCreditPaise: returns._sum.creditPaise ?? 0,
  });
}

export async function findVendorById(garageId: string, vendorId: string) {
  return prisma.vendor.findFirst({
    where: { id: vendorId, garageId },
    include: {
      purchaseOrders: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          number: true,
          status: true,
          createdAt: true,
        },
      },
      vendorBills: {
        orderBy: { billDate: "desc" },
        take: 20,
        select: {
          id: true,
          billNumber: true,
          billDate: true,
          amountPaise: true,
          payments: { select: { amountPaise: true } },
          returns: { select: { creditPaise: true } },
        },
      },
      purchaseReturns: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          quantity: true,
          creditPaise: true,
          createdAt: true,
          part: { select: { id: true, name: true, sku: true, unit: true } },
        },
      },
    },
  });
}

const vendorSelect = {
  id: true,
  name: true,
  phone: true,
  email: true,
  address: true,
  gstin: true,
  notes: true,
} as const;

export async function createVendor(
  garageId: string,
  data: {
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    gstin: string | null;
    notes: string | null;
    actorId: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    const vendor = await tx.vendor.create({
      data: {
        garageId,
        name: data.name,
        phone: data.phone,
        email: data.email,
        address: data.address,
        gstin: data.gstin,
        notes: data.notes,
      },
      select: vendorSelect,
    });

    await tx.auditLog.create({
      data: {
        garageId,
        actorId: data.actorId,
        action: "vendor.created",
        entity: "Vendor",
        entityId: vendor.id,
        meta: { name: vendor.name } satisfies Prisma.InputJsonValue,
      },
    });

    return vendor;
  });
}

export async function updateVendorById(
  garageId: string,
  vendorId: string,
  data: {
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    gstin: string | null;
    notes: string | null;
    actorId: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    const result = await tx.vendor.updateMany({
      where: { id: vendorId, garageId },
      data: {
        name: data.name,
        phone: data.phone,
        email: data.email,
        address: data.address,
        gstin: data.gstin,
        notes: data.notes,
      },
    });
    if (result.count === 0) {
      return null;
    }

    await tx.auditLog.create({
      data: {
        garageId,
        actorId: data.actorId,
        action: "vendor.updated",
        entity: "Vendor",
        entityId: vendorId,
        meta: { name: data.name } satisfies Prisma.InputJsonValue,
      },
    });

    return tx.vendor.findFirst({
      where: { id: vendorId, garageId },
      select: vendorSelect,
    });
  });
}

export async function listVendorsForSelect(garageId: string) {
  return prisma.vendor.findMany({
    where: { garageId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function countVendorLinkedRecords(
  garageId: string,
  vendorId: string,
) {
  const [purchaseOrders, vendorBills, purchaseReturns] = await Promise.all([
    prisma.purchaseOrder.count({ where: { garageId, vendorId } }),
    prisma.vendorBill.count({ where: { garageId, vendorId } }),
    prisma.purchaseReturn.count({ where: { garageId, vendorId } }),
  ]);
  return purchaseOrders + vendorBills + purchaseReturns;
}

export async function deleteVendorById(
  garageId: string,
  vendorId: string,
  data: { actorId: string; name: string },
) {
  return prisma.$transaction(async (tx) => {
    const result = await tx.vendor.deleteMany({
      where: { id: vendorId, garageId },
    });

    if (result.count === 0) {
      return null;
    }

    await tx.auditLog.create({
      data: {
        garageId,
        actorId: data.actorId,
        action: "vendor.deleted",
        entity: "Vendor",
        entityId: vendorId,
        meta: { name: data.name } satisfies Prisma.InputJsonValue,
      },
    });

    return { id: vendorId };
  });
}

import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const warrantySelect = {
  id: true,
  garageId: true,
  vehicleId: true,
  customerId: true,
  partName: true,
  invoiceId: true,
  invoiceLineId: true,
  warrantyExpiresAt: true,
  storageKey: true,
  contentType: true,
  byteSize: true,
  fileName: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  vehicle: {
    select: {
      id: true,
      registrationNumber: true,
      make: true,
      model: true,
    },
  },
} as const;

export type WarrantyDocumentRow = Prisma.VehicleWarrantyDocumentGetPayload<{
  select: typeof warrantySelect;
}>;

export async function listWarrantiesForVehicle(
  garageId: string,
  vehicleId: string,
) {
  return prisma.vehicleWarrantyDocument.findMany({
    where: { garageId, vehicleId },
    select: warrantySelect,
    orderBy: [{ createdAt: "desc" }],
  });
}

export async function listWarrantiesForCustomer(
  garageId: string,
  customerId: string,
) {
  return prisma.vehicleWarrantyDocument.findMany({
    where: { garageId, customerId },
    select: warrantySelect,
    orderBy: [{ createdAt: "desc" }],
  });
}

export async function listWarrantiesForInvoice(
  garageId: string,
  invoiceId: string,
) {
  return prisma.vehicleWarrantyDocument.findMany({
    where: { garageId, invoiceId },
    select: warrantySelect,
    orderBy: [{ createdAt: "asc" }],
  });
}

export async function findWarrantyById(garageId: string, warrantyId: string) {
  return prisma.vehicleWarrantyDocument.findFirst({
    where: { id: warrantyId, garageId },
    select: warrantySelect,
  });
}

export async function findWarrantyByInvoiceLine(
  garageId: string,
  invoiceLineId: string,
) {
  return prisma.vehicleWarrantyDocument.findFirst({
    where: { garageId, invoiceLineId },
    select: warrantySelect,
  });
}

export async function upsertInvoiceLineWarranty(data: {
  garageId: string;
  vehicleId: string;
  customerId: string;
  partName: string;
  invoiceId: string;
  invoiceLineId: string;
  warrantyExpiresAt: Date | null;
  storageKey: string | null;
  contentType: string | null;
  byteSize: number | null;
  fileName: string | null;
  createdById: string;
}) {
  const existing = await findWarrantyByInvoiceLine(
    data.garageId,
    data.invoiceLineId,
  );

  if (existing) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.vehicleWarrantyDocument.update({
        where: { id: existing.id },
        data: {
          partName: data.partName,
          warrantyExpiresAt: data.warrantyExpiresAt,
          storageKey: data.storageKey,
          contentType: data.contentType,
          byteSize: data.byteSize,
          fileName: data.fileName,
        },
        select: warrantySelect,
      });

      await tx.auditLog.create({
        data: {
          garageId: data.garageId,
          actorId: data.createdById,
          action: "warranty.updated",
          entity: "VehicleWarrantyDocument",
          entityId: updated.id,
          meta: {
            partName: data.partName,
            invoiceLineId: data.invoiceLineId,
            vehicleId: data.vehicleId,
          } satisfies Prisma.InputJsonValue,
        },
      });

      return updated;
    });
  }

  return prisma.$transaction(async (tx) => {
    const created = await tx.vehicleWarrantyDocument.create({
      data: {
        garageId: data.garageId,
        vehicleId: data.vehicleId,
        customerId: data.customerId,
        partName: data.partName,
        invoiceId: data.invoiceId,
        invoiceLineId: data.invoiceLineId,
        warrantyExpiresAt: data.warrantyExpiresAt,
        storageKey: data.storageKey,
        contentType: data.contentType,
        byteSize: data.byteSize,
        fileName: data.fileName,
        createdById: data.createdById,
      },
      select: warrantySelect,
    });

    await tx.auditLog.create({
      data: {
        garageId: data.garageId,
        actorId: data.createdById,
        action: "warranty.created",
        entity: "VehicleWarrantyDocument",
        entityId: created.id,
        meta: {
          partName: data.partName,
          invoiceLineId: data.invoiceLineId,
          vehicleId: data.vehicleId,
          source: "invoice",
        } satisfies Prisma.InputJsonValue,
      },
    });

    return created;
  });
}

export async function createManualWarranty(data: {
  garageId: string;
  vehicleId: string;
  customerId: string;
  partName: string;
  invoiceId?: string | null;
  warrantyExpiresAt: Date | null;
  storageKey: string | null;
  contentType: string | null;
  byteSize: number | null;
  fileName: string | null;
  createdById: string;
}) {
  return prisma.$transaction(async (tx) => {
    const created = await tx.vehicleWarrantyDocument.create({
      data: {
        garageId: data.garageId,
        vehicleId: data.vehicleId,
        customerId: data.customerId,
        partName: data.partName,
        invoiceId: data.invoiceId ?? null,
        warrantyExpiresAt: data.warrantyExpiresAt,
        storageKey: data.storageKey,
        contentType: data.contentType,
        byteSize: data.byteSize,
        fileName: data.fileName,
        createdById: data.createdById,
      },
      select: warrantySelect,
    });

    await tx.auditLog.create({
      data: {
        garageId: data.garageId,
        actorId: data.createdById,
        action: "warranty.created",
        entity: "VehicleWarrantyDocument",
        entityId: created.id,
        meta: {
          partName: data.partName,
          vehicleId: data.vehicleId,
          source: "manual",
        } satisfies Prisma.InputJsonValue,
      },
    });

    return created;
  });
}

/** Re-attach a warranty to a new draft invoice line after remake. */
export async function relinkWarrantyToInvoiceLine(data: {
  garageId: string;
  warrantyId: string;
  invoiceId: string;
  invoiceLineId: string;
  actorId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.vehicleWarrantyDocument.findFirst({
      where: { id: data.warrantyId, garageId: data.garageId },
      select: warrantySelect,
    });
    if (!existing) {
      return null;
    }

    const updated = await tx.vehicleWarrantyDocument.update({
      where: { id: data.warrantyId },
      data: {
        invoiceId: data.invoiceId,
        invoiceLineId: data.invoiceLineId,
      },
      select: warrantySelect,
    });

    await tx.auditLog.create({
      data: {
        garageId: data.garageId,
        actorId: data.actorId,
        action: "warranty.relinked",
        entity: "VehicleWarrantyDocument",
        entityId: updated.id,
        meta: {
          invoiceId: data.invoiceId,
          invoiceLineId: data.invoiceLineId,
          partName: updated.partName,
        } satisfies Prisma.InputJsonValue,
      },
    });

    return updated;
  });
}

export async function deleteWarrantyById(
  garageId: string,
  warrantyId: string,
  actorId: string,
) {
  const existing = await findWarrantyById(garageId, warrantyId);
  if (!existing) {
    return null;
  }

  await prisma.$transaction(async (tx) => {
    await tx.vehicleWarrantyDocument.delete({
      where: { id: warrantyId },
    });
    await tx.auditLog.create({
      data: {
        garageId,
        actorId,
        action: "warranty.deleted",
        entity: "VehicleWarrantyDocument",
        entityId: warrantyId,
        meta: {
          partName: existing.partName,
          vehicleId: existing.vehicleId,
        } satisfies Prisma.InputJsonValue,
      },
    });
  });

  return existing;
}

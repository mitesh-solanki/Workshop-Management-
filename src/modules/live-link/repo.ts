import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const liveLinkSelect = {
  id: true,
  garageId: true,
  serviceOrderId: true,
  tokenHash: true,
  expiresAt: true,
  revokedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function createLiveLinkRow(data: {
  garageId: string;
  serviceOrderId: string;
  tokenHash: string;
  expiresAt: Date;
  createdById: string;
}) {
  return prisma.$transaction(async (tx) => {
    await tx.liveLink.updateMany({
      where: {
        garageId: data.garageId,
        serviceOrderId: data.serviceOrderId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    const link = await tx.liveLink.create({
      data: {
        garageId: data.garageId,
        serviceOrderId: data.serviceOrderId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
        createdById: data.createdById,
      },
      select: liveLinkSelect,
    });

    await tx.auditLog.create({
      data: {
        garageId: data.garageId,
        actorId: data.createdById,
        action: "live_link.created",
        entity: "LiveLink",
        entityId: link.id,
        meta: {
          serviceOrderId: data.serviceOrderId,
          expiresAt: data.expiresAt.toISOString(),
        } satisfies Prisma.InputJsonValue,
      },
    });

    return link;
  });
}

export async function findLiveLinkByTokenHash(tokenHash: string) {
  return prisma.liveLink.findUnique({
    where: { tokenHash },
    select: {
      ...liveLinkSelect,
      garage: { select: { id: true, name: true } },
      serviceOrder: {
        select: {
          id: true,
          status: true,
          expectedCompletion: true,
          vehicle: {
            select: {
              registrationNumber: true,
              make: true,
              model: true,
            },
          },
        },
      },
    },
  });
}

export async function findActiveLiveLinkForOrder(
  garageId: string,
  serviceOrderId: string,
) {
  return prisma.liveLink.findFirst({
    where: {
      garageId,
      serviceOrderId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: liveLinkSelect,
  });
}

export async function revokeLiveLinksForOrder(
  garageId: string,
  serviceOrderId: string,
  actorId: string,
) {
  const result = await prisma.liveLink.updateMany({
    where: {
      garageId,
      serviceOrderId,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });

  if (result.count > 0) {
    await prisma.auditLog.create({
      data: {
        garageId,
        actorId,
        action: "live_link.revoked",
        entity: "LiveLink",
        entityId: serviceOrderId,
        meta: { serviceOrderId, count: result.count },
      },
    });
  }

  return result;
}

export async function loadLiveOrderSnapshot(
  garageId: string,
  serviceOrderId: string,
) {
  const [order, inspection, estimate, invoices] = await Promise.all([
    prisma.serviceOrder.findFirst({
      where: { id: serviceOrderId, garageId },
      select: {
        id: true,
        status: true,
        expectedCompletion: true,
        vehicle: {
          select: {
            registrationNumber: true,
            make: true,
            model: true,
          },
        },
      },
    }),
    prisma.inspection.findFirst({
      where: { garageId, serviceOrderId },
      select: {
        id: true,
        items: {
          select: {
            id: true,
            label: true,
            result: true,
            media: {
              select: {
                id: true,
                kind: true,
                storageKey: true,
                contentType: true,
              },
              orderBy: { createdAt: "asc" },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    }),
    prisma.estimate.findFirst({
      where: { garageId, serviceOrderId, supersededAt: null },
      select: {
        id: true,
        revisionNumber: true,
        lines: {
          select: {
            id: true,
            type: true,
            description: true,
            quantity: true,
            unitPricePaise: true,
            gstRatePercent: true,
            hsnOrSac: true,
            approvalState: true,
            sortOrder: true,
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    }),
    prisma.invoice.findMany({
      where: {
        garageId,
        serviceOrderId,
        status: "FINALIZED",
      },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        totalPaise: true,
        amountPaidPaise: true,
        taxablePaise: true,
        cgstPaise: true,
        sgstPaise: true,
        igstPaise: true,
        creditNotes: { select: { totalPaise: true } },
        lines: {
          select: {
            id: true,
            type: true,
            description: true,
            quantity: true,
            unitPricePaise: true,
            totalPaise: true,
          },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { finalizedAt: "desc" },
    }),
  ]);

  return { order, inspection, estimate, invoices };
}

export async function findEstimateLineForLive(
  garageId: string,
  lineId: string,
) {
  return prisma.estimateLine.findFirst({
    where: { id: lineId, garageId },
    select: {
      id: true,
      estimateId: true,
      approvalState: true,
      estimate: {
        select: {
          id: true,
          serviceOrderId: true,
          supersededAt: true,
        },
      },
    },
  });
}

export async function recordOnlineLineApproval(
  garageId: string,
  data: {
    estimateId: string;
    estimateLineId: string;
    serviceOrderId: string;
    fromState: "PENDING" | "APPROVED" | "REJECTED";
    toState: "APPROVED" | "REJECTED";
  },
) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.estimateLine.updateMany({
      where: {
        id: data.estimateLineId,
        garageId,
        estimateId: data.estimateId,
        approvalState: data.fromState,
      },
      data: { approvalState: data.toState },
    });
    if (updated.count === 0) {
      return null;
    }

    const approval = await tx.estimateApproval.create({
      data: {
        garageId,
        estimateId: data.estimateId,
        estimateLineId: data.estimateLineId,
        fromState: data.fromState,
        toState: data.toState,
        method: "ONLINE",
        recordedById: null,
        note: null,
      },
    });

    await tx.auditLog.create({
      data: {
        garageId,
        actorId: null,
        action: "estimate.line_approval_online",
        entity: "Estimate",
        entityId: data.estimateId,
        meta: {
          serviceOrderId: data.serviceOrderId,
          lineId: data.estimateLineId,
          fromState: data.fromState,
          toState: data.toState,
          method: "ONLINE",
          approvalId: approval.id,
        } satisfies Prisma.InputJsonValue,
      },
    });

    return approval;
  });
}

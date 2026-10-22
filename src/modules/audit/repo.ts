import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type WriteAuditLogInput = {
  garageId: string;
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  meta?: Prisma.InputJsonValue;
};

export async function createAuditLog(input: WriteAuditLogInput) {
  return prisma.auditLog.create({
    data: {
      garageId: input.garageId,
      actorId: input.actorId ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      meta: input.meta,
    },
  });
}

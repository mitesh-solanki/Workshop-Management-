import "server-only";

import { prisma } from "@/lib/db";

export async function createEmailLogRow(input: {
  type: string;
  recipientHash: string;
  recipientMasked: string;
  provider: string;
  success: boolean;
  providerRequestId?: string | null;
  errorCode?: string | null;
}) {
  return prisma.emailLog.create({
    data: {
      type: input.type,
      recipientHash: input.recipientHash,
      recipientMasked: input.recipientMasked,
      provider: input.provider,
      success: input.success,
      providerRequestId: input.providerRequestId ?? null,
      errorCode: input.errorCode ?? null,
    },
  });
}

export async function findRateLimitBucket(key: string) {
  return prisma.rateLimitBucket.findUnique({ where: { key } });
}

export async function upsertRateLimitBucket(input: {
  key: string;
  count: number;
  windowStart: Date;
  expiresAt: Date;
}) {
  return prisma.rateLimitBucket.upsert({
    where: { key: input.key },
    create: {
      key: input.key,
      count: input.count,
      windowStart: input.windowStart,
      expiresAt: input.expiresAt,
    },
    update: {
      count: input.count,
      windowStart: input.windowStart,
      expiresAt: input.expiresAt,
    },
  });
}

export async function incrementRateLimitBucket(key: string) {
  return prisma.rateLimitBucket.update({
    where: { key },
    data: { count: { increment: 1 } },
  });
}

import "server-only";

import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { OtpPayload, OtpPurpose } from "@/lib/otp";

/**
 * Global lookup by email before a garage is known (login / signup / invite).
 * Email is unique across users; do not use for tenant-scoped business queries.
 */
export async function findUserByEmailForLogin(email: string) {
  return prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
}

/**
 * Global user lookup by id for JWT session refresh.
 * The session already authenticated the user; garage comes from the user row.
 */
export async function findUserByIdForSessionRefresh(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      garageId: true,
      role: true,
    },
  });
}

/** Auth.js adapter binds Account/Session/User tables; lives in repo so only repos touch Prisma. */
export function createPrismaAuthAdapter() {
  return PrismaAdapter(prisma);
}

/**
 * Email OTP rows are pre-auth and have no garageId.
 * Lookups are global by email (+ purpose); consume invalidates by row id.
 */
export async function invalidateOpenEmailOtps(input: {
  email: string;
  purpose: OtpPurpose;
}) {
  return prisma.emailOtp.updateMany({
    where: {
      email: input.email,
      purpose: input.purpose,
      consumedAt: null,
    },
    data: { consumedAt: new Date() },
  });
}

export async function createEmailOtpRow(input: {
  email: string;
  codeHash: string;
  purpose: OtpPurpose;
  payload?: OtpPayload;
  expiresAt: Date;
}) {
  return prisma.emailOtp.create({
    data: {
      email: input.email,
      codeHash: input.codeHash,
      purpose: input.purpose,
      payload: (input.payload ?? undefined) as
        | Prisma.InputJsonValue
        | undefined,
      expiresAt: input.expiresAt,
    },
  });
}

export async function findOpenEmailOtps(input: {
  email: string;
  purpose?: OtpPurpose;
  take?: number;
}) {
  return prisma.emailOtp.findMany({
    where: {
      email: input.email,
      consumedAt: null,
      expiresAt: { gt: new Date() },
      ...(input.purpose ? { purpose: input.purpose } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: input.take ?? 5,
  });
}

export async function findLatestEmailOtp(input: {
  email: string;
  purpose?: OtpPurpose;
}) {
  return prisma.emailOtp.findFirst({
    where: {
      email: input.email,
      ...(input.purpose ? { purpose: input.purpose } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function markEmailOtpConsumed(id: string) {
  return prisma.emailOtp.update({
    where: { id },
    data: { consumedAt: new Date() },
  });
}

export async function incrementEmailOtpAttempts(id: string) {
  return prisma.emailOtp.update({
    where: { id },
    data: { attempts: { increment: 1 } },
  });
}

/** Global by email — invite acceptance before the user has a garage session. */
export async function findPendingInviteByEmail(email: string) {
  return prisma.invite.findFirst({
    where: {
      email: email.trim().toLowerCase(),
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { garage: true },
    orderBy: { createdAt: "desc" },
  });
}

/** Global by token hash — invite link has no garage context yet. */
export async function findPendingInviteByTokenHash(tokenHash: string) {
  return prisma.invite.findFirst({
    where: {
      tokenHash,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { garage: true },
  });
}

export async function createOwnerWithGarage(input: {
  email: string;
  name: string;
  garageName: string;
}) {
  return prisma.$transaction(async (tx) => {
    const garage = await tx.garage.create({
      data: { name: input.garageName },
    });

    const user = await tx.user.create({
      data: {
        email: input.email,
        name: input.name,
        emailVerified: new Date(),
        role: "OWNER",
        garageId: garage.id,
      },
    });

    await tx.auditLog.create({
      data: {
        garageId: garage.id,
        actorId: user.id,
        action: "garage.created",
        entity: "Garage",
        entityId: garage.id,
        meta: { name: garage.name },
      },
    });

    return { user, garage };
  });
}

/** Idempotent dummy / demo technician for a garage (production bootstrap). */
export async function ensureTechnicianInGarage(input: {
  garageId: string;
  email: string;
  name: string;
  actorId?: string;
}) {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (
      existing.garageId === input.garageId &&
      existing.role === "TECHNICIAN"
    ) {
      if (existing.name !== input.name) {
        return prisma.user.update({
          where: { id: existing.id },
          data: { name: input.name },
        });
      }
      return existing;
    }
    return existing;
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        name: input.name,
        emailVerified: new Date(),
        role: "TECHNICIAN",
        garageId: input.garageId,
      },
    });

    await tx.auditLog.create({
      data: {
        garageId: input.garageId,
        actorId: input.actorId ?? user.id,
        action: "user.created",
        entity: "User",
        entityId: user.id,
        meta: {
          role: "TECHNICIAN",
          email,
          source: "prod_dummy_mechanic",
        } satisfies Prisma.InputJsonValue,
      },
    });

    return user;
  });
}

export async function acceptInviteAndCreateUser(input: {
  inviteId: string;
  email: string;
  name: string;
  role: Role;
  garageId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: input.email,
        name: input.name,
        emailVerified: new Date(),
        role: input.role,
        garageId: input.garageId,
      },
    });

    await tx.invite.update({
      where: { id: input.inviteId },
      data: { acceptedAt: new Date() },
    });

    await tx.auditLog.create({
      data: {
        garageId: input.garageId,
        actorId: user.id,
        action: "invite.accepted",
        entity: "Invite",
        entityId: input.inviteId,
        meta: {
          role: input.role,
          email: input.email,
        } satisfies Prisma.InputJsonValue,
      },
    });

    return user;
  });
}

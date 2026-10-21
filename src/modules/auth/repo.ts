import "server-only";

import type { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
}

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
        meta: { role: input.role, email: input.email } satisfies Prisma.InputJsonValue,
      },
    });

    return user;
  });
}

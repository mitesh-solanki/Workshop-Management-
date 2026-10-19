import "server-only";

import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function listUsersByGarage(garageId: string) {
  return prisma.user.findMany({
    where: { garageId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
}

export async function listInvitesByGarage(garageId: string) {
  return prisma.invite.findMany({
    where: { garageId, acceptedAt: null, expiresAt: { gt: new Date() } },
    select: {
      id: true,
      email: true,
      role: true,
      expiresAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createInvite(input: {
  garageId: string;
  email: string;
  role: Role;
  tokenHash: string;
  invitedBy: string;
  expiresAt: Date;
}) {
  return prisma.invite.upsert({
    where: {
      garageId_email: {
        garageId: input.garageId,
        email: input.email,
      },
    },
    create: {
      garageId: input.garageId,
      email: input.email,
      role: input.role,
      tokenHash: input.tokenHash,
      invitedBy: input.invitedBy,
      expiresAt: input.expiresAt,
    },
    update: {
      role: input.role,
      tokenHash: input.tokenHash,
      invitedBy: input.invitedBy,
      expiresAt: input.expiresAt,
      acceptedAt: null,
    },
  });
}

export async function findUserInGarage(garageId: string, userId: string) {
  return prisma.user.findFirst({
    where: { id: userId, garageId },
    select: { id: true, email: true, role: true, garageId: true },
  });
}

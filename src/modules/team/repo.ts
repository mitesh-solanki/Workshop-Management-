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
      lastEmailStatus: true,
      lastEmailAt: true,
      locale: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function findGarageName(garageId: string) {
  return prisma.garage.findFirst({
    where: { id: garageId },
    select: { id: true, name: true },
  });
}

export async function createInvite(input: {
  garageId: string;
  email: string;
  role: Role;
  tokenHash: string;
  invitedBy: string;
  expiresAt: Date;
  locale: string;
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
      locale: input.locale,
      lastEmailStatus: null,
      lastEmailAt: null,
      lastEmailError: null,
    },
    update: {
      role: input.role,
      tokenHash: input.tokenHash,
      invitedBy: input.invitedBy,
      expiresAt: input.expiresAt,
      locale: input.locale,
      acceptedAt: null,
      lastEmailStatus: null,
      lastEmailAt: null,
      lastEmailError: null,
    },
  });
}

export async function findPendingInviteInGarage(
  garageId: string,
  inviteId: string,
) {
  return prisma.invite.findFirst({
    where: {
      id: inviteId,
      garageId,
      acceptedAt: null,
    },
    select: {
      id: true,
      email: true,
      role: true,
      expiresAt: true,
      createdAt: true,
      locale: true,
      lastEmailStatus: true,
      lastEmailAt: true,
    },
  });
}

export async function refreshInviteToken(input: {
  inviteId: string;
  garageId: string;
  tokenHash: string;
  invitedBy: string;
  expiresAt: Date;
  locale?: string;
}) {
  return prisma.invite.updateMany({
    where: {
      id: input.inviteId,
      garageId: input.garageId,
      acceptedAt: null,
    },
    data: {
      tokenHash: input.tokenHash,
      invitedBy: input.invitedBy,
      expiresAt: input.expiresAt,
      ...(input.locale ? { locale: input.locale } : {}),
    },
  });
}

export async function updateInviteEmailStatus(input: {
  inviteId: string;
  garageId: string;
  status: "sent" | "failed";
  errorCode?: string | null;
}) {
  return prisma.invite.updateMany({
    where: {
      id: input.inviteId,
      garageId: input.garageId,
      acceptedAt: null,
    },
    data: {
      lastEmailStatus: input.status,
      lastEmailAt: new Date(),
      lastEmailError: input.status === "failed" ? (input.errorCode ?? "SEND_FAILED") : null,
    },
  });
}

export async function deleteInviteInGarage(garageId: string, inviteId: string) {
  return prisma.invite.deleteMany({
    where: { id: inviteId, garageId, acceptedAt: null },
  });
}

export async function findUserInGarage(garageId: string, userId: string) {
  return prisma.user.findFirst({
    where: { id: userId, garageId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      garageId: true,
    },
  });
}

export async function updateUserRoleInGarage(input: {
  garageId: string;
  userId: string;
  role: Role;
}) {
  return prisma.user.updateMany({
    where: { id: input.userId, garageId: input.garageId },
    data: { role: input.role },
  });
}

export async function deleteUserInGarage(garageId: string, userId: string) {
  return prisma.user.deleteMany({
    where: { id: userId, garageId },
  });
}

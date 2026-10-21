import "server-only";

import { randomBytes } from "node:crypto";
import { writeAuditLog } from "@/lib/audit";
import { AppError, ForbiddenError } from "@/lib/errors";
import { hashToken } from "@/lib/otp";
import { requireRole, type RoleSession } from "@/lib/rbac";
import { findUserByEmail } from "@/modules/auth/repo";
import {
  createInvite,
  findUserInGarage,
  listInvitesByGarage,
  listUsersByGarage,
} from "@/modules/team/repo";
import {
  createInviteSchema,
  type CreateInviteInput,
} from "@/modules/team/schema";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function listTeam(session: RoleSession) {
  requireRole(session, ["OWNER", "MANAGER"]);
  const [members, invites] = await Promise.all([
    listUsersByGarage(session.garageId),
    listInvitesByGarage(session.garageId),
  ]);
  return { members, invites };
}

export async function inviteTeamMember(
  session: RoleSession,
  raw: CreateInviteInput,
) {
  requireRole(session, ["OWNER"]);
  const input = createInviteSchema.parse(raw);
  const email = input.email.trim().toLowerCase();

  const existing = await findUserByEmail(email);
  if (existing) {
    throw new AppError("EMAIL_IN_USE", "That email already has an account");
  }

  const token = randomBytes(32).toString("base64url");
  const invite = await createInvite({
    garageId: session.garageId,
    email,
    role: input.role,
    tokenHash: hashToken(token),
    invitedBy: session.userId,
    expiresAt: new Date(Date.now() + INVITE_TTL_MS),
  });

  await writeAuditLog({
    garageId: session.garageId,
    actorId: session.userId,
    action: "invite.created",
    entity: "Invite",
    entityId: invite.id,
    meta: { email, role: input.role },
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return {
    invite: {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
    },
    inviteUrl: `${baseUrl}/invite/${token}`,
  };
}

/** Test helper proving cross-garage member reads are denied. */
export async function getTeamMemberForGarage(
  session: RoleSession,
  requestedGarageId: string,
  userId: string,
) {
  if (requestedGarageId !== session.garageId) {
    throw new ForbiddenError("Cross-garage access denied");
  }
  return findUserInGarage(session.garageId, userId);
}

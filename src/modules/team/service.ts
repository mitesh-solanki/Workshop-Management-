import "server-only";

import { randomBytes } from "node:crypto";
import { writeAuditLog } from "@/lib/audit";
import {
  getAppUrl,
  renderInviteEmail,
  sendLoggedEmail,
} from "@/lib/email";
import { resolveEmailLocale } from "@/lib/email/templates/copy";
import { AppError, ForbiddenError } from "@/lib/errors";
import { hashToken } from "@/lib/otp";
import { requireRole, type RoleSession } from "@/lib/rbac";
import { findUserByEmailForLogin } from "@/modules/auth/repo";
import {
  createInvite,
  deleteInviteInGarage,
  deleteUserInGarage,
  findGarageName,
  findPendingInviteInGarage,
  findUserInGarage,
  listInvitesByGarage,
  listUsersByGarage,
  refreshInviteToken,
  updateInviteEmailStatus,
  updateUserRoleInGarage,
} from "@/modules/team/repo";
import {
  changeMemberRoleSchema,
  createInviteSchema,
  inviteIdSchema,
  removeMemberSchema,
  type ChangeMemberRoleInput,
  type CreateInviteInput,
  type InviteIdInput,
  type RemoveMemberInput,
} from "@/modules/team/schema";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function inviteUrlForToken(token: string) {
  return `${getAppUrl().replace(/\/$/, "")}/invite/${token}`;
}

async function sendTeamInviteEmail(input: {
  inviteId: string;
  garageId: string;
  email: string;
  role: string;
  garageName: string;
  token: string;
  expiresAt: Date;
  locale: string;
}) {
  const acceptUrl = inviteUrlForToken(input.token);
  const rendered = renderInviteEmail({
    garageName: input.garageName,
    role: input.role,
    acceptUrl,
    expiresAt: input.expiresAt,
    locale: input.locale,
  });

  const sent = await sendLoggedEmail({
    type: "team_invite",
    to: input.email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  });

  await updateInviteEmailStatus({
    inviteId: input.inviteId,
    garageId: input.garageId,
    status: sent.ok ? "sent" : "failed",
    errorCode: sent.errorCode ?? null,
  });

  if (!sent.ok) {
    throw new AppError("team.email_send_failed", 502);
  }

  return { acceptUrl };
}

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
  opts?: { locale?: string | null },
) {
  requireRole(session, ["OWNER"]);
  const input = createInviteSchema.parse(raw);
  const email = input.email.trim().toLowerCase();
  const locale = resolveEmailLocale(opts?.locale);

  const existing = await findUserByEmailForLogin(email);
  if (existing) {
    throw new AppError("team.email_in_use");
  }

  const garage = await findGarageName(session.garageId);
  if (!garage) {
    throw new AppError("team.not_found", 404);
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  const invite = await createInvite({
    garageId: session.garageId,
    email,
    role: input.role,
    tokenHash: hashToken(token),
    invitedBy: session.userId,
    expiresAt,
    locale,
  });

  await writeAuditLog({
    garageId: session.garageId,
    actorId: session.userId,
    action: "invite.created",
    entity: "Invite",
    entityId: invite.id,
    meta: { email, role: input.role },
  });

  await sendTeamInviteEmail({
    inviteId: invite.id,
    garageId: session.garageId,
    email,
    role: input.role,
    garageName: garage.name,
    token,
    expiresAt,
    locale,
  });

  return {
    invite: {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      lastEmailStatus: "sent" as const,
    },
  };
}

export async function resendInvite(
  session: RoleSession,
  raw: InviteIdInput,
  opts?: { locale?: string | null },
) {
  requireRole(session, ["OWNER"]);
  const { inviteId } = inviteIdSchema.parse(raw);

  const invite = await findPendingInviteInGarage(session.garageId, inviteId);
  if (!invite) {
    throw new AppError("team.not_found", 404);
  }

  if (invite.expiresAt.getTime() <= Date.now()) {
    throw new AppError("team.invite_expired", 410);
  }

  const existing = await findUserByEmailForLogin(invite.email);
  if (existing) {
    throw new AppError("team.email_in_use");
  }

  const garage = await findGarageName(session.garageId);
  if (!garage) {
    throw new AppError("team.not_found", 404);
  }

  const locale = resolveEmailLocale(opts?.locale ?? invite.locale);
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  const updated = await refreshInviteToken({
    inviteId: invite.id,
    garageId: session.garageId,
    tokenHash: hashToken(token),
    invitedBy: session.userId,
    expiresAt,
    locale,
  });
  if (updated.count === 0) {
    throw new AppError("team.not_found", 404);
  }

  await sendTeamInviteEmail({
    inviteId: invite.id,
    garageId: session.garageId,
    email: invite.email,
    role: invite.role,
    garageName: garage.name,
    token,
    expiresAt,
    locale,
  });

  await writeAuditLog({
    garageId: session.garageId,
    actorId: session.userId,
    action: "invite.resent",
    entity: "Invite",
    entityId: invite.id,
    meta: { email: invite.email, role: invite.role },
  });

  return {
    invite: {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      expiresAt,
      lastEmailStatus: "sent" as const,
    },
  };
}

export async function revokeInvite(session: RoleSession, raw: InviteIdInput) {
  requireRole(session, ["OWNER"]);
  const { inviteId } = inviteIdSchema.parse(raw);

  const invite = await findPendingInviteInGarage(session.garageId, inviteId);
  if (!invite) {
    throw new AppError("team.not_found", 404);
  }

  const deleted = await deleteInviteInGarage(session.garageId, invite.id);
  if (deleted.count === 0) {
    throw new AppError("team.not_found", 404);
  }

  await writeAuditLog({
    garageId: session.garageId,
    actorId: session.userId,
    action: "invite.revoked",
    entity: "Invite",
    entityId: invite.id,
    meta: { email: invite.email, role: invite.role },
  });

  return { id: invite.id };
}

export async function changeMemberRole(
  session: RoleSession,
  raw: ChangeMemberRoleInput,
) {
  requireRole(session, ["OWNER"]);
  const input = changeMemberRoleSchema.parse(raw);

  if (input.userId === session.userId) {
    throw new AppError("team.cannot_change_self");
  }

  const member = await findUserInGarage(session.garageId, input.userId);
  if (!member) {
    throw new AppError("team.not_found", 404);
  }
  if (member.role === "OWNER") {
    throw new AppError("team.cannot_change_owner");
  }

  if (member.role === input.role) {
    return member;
  }

  const updated = await updateUserRoleInGarage({
    garageId: session.garageId,
    userId: member.id,
    role: input.role,
  });
  if (updated.count === 0) {
    throw new AppError("team.not_found", 404);
  }

  await writeAuditLog({
    garageId: session.garageId,
    actorId: session.userId,
    action: "user.role_changed",
    entity: "User",
    entityId: member.id,
    meta: {
      email: member.email,
      fromRole: member.role,
      toRole: input.role,
    },
  });

  return { ...member, role: input.role };
}

export async function removeMember(
  session: RoleSession,
  raw: RemoveMemberInput,
) {
  requireRole(session, ["OWNER"]);
  const input = removeMemberSchema.parse(raw);

  if (input.userId === session.userId) {
    throw new AppError("team.cannot_remove_self");
  }

  const member = await findUserInGarage(session.garageId, input.userId);
  if (!member) {
    throw new AppError("team.not_found", 404);
  }
  if (member.role === "OWNER") {
    throw new AppError("team.cannot_remove_owner");
  }

  const deleted = await deleteUserInGarage(session.garageId, member.id);
  if (deleted.count === 0) {
    throw new AppError("team.not_found", 404);
  }

  await writeAuditLog({
    garageId: session.garageId,
    actorId: session.userId,
    action: "user.removed",
    entity: "User",
    entityId: member.id,
    meta: { email: member.email, role: member.role },
  });

  return { id: member.id };
}

/** Test helper proving cross-garage member reads are denied. */
export async function getTeamMemberForGarage(
  session: RoleSession,
  requestedGarageId: string,
  userId: string,
) {
  if (requestedGarageId !== session.garageId) {
    throw new ForbiddenError();
  }
  return findUserInGarage(session.garageId, userId);
}

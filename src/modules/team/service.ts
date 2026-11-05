import "server-only";

import { randomBytes } from "node:crypto";
import { writeAuditLog } from "@/lib/audit";
import {
  getAppUrl,
  renderInviteEmail,
  renderPasswordResetEmail,
  sendLoggedEmail,
} from "@/lib/email";
import { resolveEmailLocale } from "@/lib/email/templates/copy";
import { AppError, ForbiddenError } from "@/lib/errors";
import { hashToken } from "@/lib/otp";
import {
  PASSWORD_RESET_TTL_MS,
  hashPassword,
  verifyPassword,
} from "@/lib/password";
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
  findUserIdByEmail,
  setMemberPasswordInGarage,
  setMemberPasswordResetTokenInGarage,
  updateInviteEmailStatus,
  updateMemberActiveInGarage,
  updateMemberInGarage,
  updateUserRoleInGarage,
} from "@/modules/team/repo";
import {
  changeMemberRoleSchema,
  createInviteSchema,
  inviteIdSchema,
  removeMemberSchema,
  sendMemberPasswordResetSchema,
  setMemberActiveSchema,
  setMemberPasswordSchema,
  updateMemberSchema,
  type ChangeMemberRoleInput,
  type CreateInviteInput,
  type InviteIdInput,
  type RemoveMemberInput,
  type SendMemberPasswordResetInput,
  type SetMemberActiveInput,
  type SetMemberPasswordInput,
  type UpdateMemberInput,
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

  // Without a verified mail domain, Owner still gets a copyable invite link.
  return { acceptUrl, emailSent: sent.ok };
}

function toPublicMember<T extends { passwordHash?: string | null }>(
  member: T,
) {
  const { passwordHash, ...rest } = member;
  return {
    ...rest,
    hasPassword: Boolean(passwordHash),
  };
}

function assertOwnerCanManageMember(
  session: RoleSession,
  member: { id: string; role: string },
) {
  requireRole(session, ["OWNER"]);
  if (member.id === session.userId) {
    throw new AppError("team.cannot_change_self");
  }
  if (member.role === "OWNER") {
    throw new AppError("team.cannot_change_owner");
  }
}

/** Password set/reset: owner may manage other staff, or their own password. */
function assertOwnerCanManagePassword(
  session: RoleSession,
  member: { id: string; role: string },
) {
  requireRole(session, ["OWNER"]);
  if (member.id === session.userId) {
    return;
  }
  if (member.role === "OWNER") {
    throw new AppError("team.cannot_change_owner");
  }
}

export async function listTeam(session: RoleSession) {
  requireRole(session, ["OWNER", "MANAGER", "ACCOUNTANT"]);
  const [rows, invites] = await Promise.all([
    listUsersByGarage(session.garageId),
    session.role === "OWNER"
      ? listInvitesByGarage(session.garageId)
      : Promise.resolve([]),
  ]);
  return {
    members: rows.map((member) => toPublicMember(member)),
    invites,
  };
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

  const mail = await sendTeamInviteEmail({
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
      lastEmailStatus: mail.emailSent ? ("sent" as const) : ("failed" as const),
    },
    acceptUrl: mail.acceptUrl,
    emailSent: mail.emailSent,
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

  const mail = await sendTeamInviteEmail({
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
      lastEmailStatus: mail.emailSent ? ("sent" as const) : ("failed" as const),
    },
    acceptUrl: mail.acceptUrl,
    emailSent: mail.emailSent,
  };
}

/** Mint a fresh invite token and return the link (no email). */
export async function copyInviteAcceptLink(
  session: RoleSession,
  raw: InviteIdInput,
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

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  const updated = await refreshInviteToken({
    inviteId: invite.id,
    garageId: session.garageId,
    tokenHash: hashToken(token),
    invitedBy: session.userId,
    expiresAt,
    locale: invite.locale ?? undefined,
  });
  if (updated.count === 0) {
    throw new AppError("team.not_found", 404);
  }

  await writeAuditLog({
    garageId: session.garageId,
    actorId: session.userId,
    action: "invite.link_copied",
    entity: "Invite",
    entityId: invite.id,
    meta: { email: invite.email, role: invite.role },
  });

  return { acceptUrl: inviteUrlForToken(token) };
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

export async function updateMember(
  session: RoleSession,
  raw: UpdateMemberInput,
) {
  requireRole(session, ["OWNER"]);
  const input = updateMemberSchema.parse(raw);

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

  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (email !== member.email.toLowerCase()) {
    const existing = await findUserIdByEmail(email);
    if (existing && existing.id !== member.id) {
      throw new AppError("team.email_in_use");
    }
  }

  const updated = await updateMemberInGarage({
    garageId: session.garageId,
    userId: member.id,
    name,
    email,
    role: input.role,
  });
  if (updated.count === 0) {
    throw new AppError("team.not_found", 404);
  }

  await writeAuditLog({
    garageId: session.garageId,
    actorId: session.userId,
    action: "user.updated",
    entity: "User",
    entityId: member.id,
    meta: {
      from: {
        name: member.name,
        email: member.email,
        role: member.role,
      },
      to: {
        name,
        email,
        role: input.role,
      },
    },
  });

  return {
    id: member.id,
    name,
    email,
    role: input.role,
  };
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

export async function setMemberActive(
  session: RoleSession,
  raw: SetMemberActiveInput,
) {
  const input = setMemberActiveSchema.parse(raw);
  const member = await findUserInGarage(session.garageId, input.userId);
  if (!member) {
    throw new AppError("team.not_found", 404);
  }
  assertOwnerCanManageMember(session, member);

  if (member.isActive === input.isActive) {
    return toPublicMember(member);
  }

  const updated = await updateMemberActiveInGarage({
    garageId: session.garageId,
    userId: member.id,
    isActive: input.isActive,
  });
  if (updated.count === 0) {
    throw new AppError("team.not_found", 404);
  }

  await writeAuditLog({
    garageId: session.garageId,
    actorId: session.userId,
    action: input.isActive ? "user.enabled" : "user.disabled",
    entity: "User",
    entityId: member.id,
    meta: { email: member.email, role: member.role },
  });

  return toPublicMember({ ...member, isActive: input.isActive });
}

export async function setMemberPassword(
  session: RoleSession,
  raw: SetMemberPasswordInput,
) {
  const input = setMemberPasswordSchema.parse(raw);
  const member = await findUserInGarage(session.garageId, input.userId);
  if (!member) {
    throw new AppError("team.not_found", 404);
  }
  assertOwnerCanManagePassword(session, member);
  if (!member.isActive) {
    throw new AppError("team.member_disabled");
  }

  if (member.passwordHash) {
    const same = await verifyPassword(input.password, member.passwordHash);
    if (same) {
      throw new AppError("auth.password_reuse", 400);
    }
  }

  const passwordHash = await hashPassword(input.password);
  const updated = await setMemberPasswordInGarage({
    garageId: session.garageId,
    userId: member.id,
    passwordHash,
  });
  if (updated.count === 0) {
    throw new AppError("team.not_found", 404);
  }

  await writeAuditLog({
    garageId: session.garageId,
    actorId: session.userId,
    action: "user.password_set",
    entity: "User",
    entityId: member.id,
    meta: {
      email: member.email,
      hadPassword: Boolean(member.passwordHash),
      self: member.id === session.userId,
    },
  });

  return toPublicMember({ ...member, passwordHash });
}

export async function sendMemberPasswordReset(
  session: RoleSession,
  raw: SendMemberPasswordResetInput,
  opts?: { locale?: string | null },
) {
  const input = sendMemberPasswordResetSchema.parse(raw);
  const member = await findUserInGarage(session.garageId, input.userId);
  if (!member) {
    throw new AppError("team.not_found", 404);
  }
  assertOwnerCanManagePassword(session, member);
  if (!member.isActive) {
    throw new AppError("team.member_disabled");
  }
  if (!member.passwordHash) {
    throw new AppError("team.no_password_yet");
  }

  const garage = await findGarageName(session.garageId);
  if (!garage) {
    throw new AppError("team.not_found", 404);
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
  const updated = await setMemberPasswordResetTokenInGarage({
    garageId: session.garageId,
    userId: member.id,
    tokenHash: hashToken(token),
    expiresAt,
  });
  if (updated.count === 0) {
    throw new AppError("team.not_found", 404);
  }

  const resetUrl = `${getAppUrl().replace(/\/$/, "")}/reset-password/${token}`;
  const locale = resolveEmailLocale(opts?.locale);
  const rendered = renderPasswordResetEmail({
    resetUrl,
    expiresAt,
    garageName: garage.name,
    memberName: member.name,
    adminRequested: member.id !== session.userId,
    locale,
  });
  const sent = await sendLoggedEmail({
    type: "password_reset",
    to: member.email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  });

  await writeAuditLog({
    garageId: session.garageId,
    actorId: session.userId,
    action: "user.password_reset_sent",
    entity: "User",
    entityId: member.id,
    meta: { email: member.email, emailSent: sent.ok },
  });

  return {
    emailSent: sent.ok,
    resetUrl: sent.ok ? null : resetUrl,
  };
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

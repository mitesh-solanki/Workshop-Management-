import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError, ForbiddenError } from "@/lib/errors";
import type { RoleSession } from "@/lib/rbac";

vi.mock("@/lib/audit", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/otp", () => ({
  hashToken: vi.fn((token: string) => `hash:${token}`),
}));

vi.mock("@/lib/email", () => ({
  getAppUrl: () => "http://localhost:3000",
  renderInviteEmail: vi.fn(() => ({
    subject: "Invite",
    html: "<a href=\"http://localhost:3000/invite/tok\">Accept</a>",
    text: "http://localhost:3000/invite/tok",
  })),
  sendLoggedEmail: vi.fn().mockResolvedValue({
    ok: true,
    provider: "fake",
    requestId: "req-1",
  }),
}));

vi.mock("@/modules/auth/repo", () => ({
  findUserByEmailForLogin: vi.fn(),
}));

vi.mock("@/modules/team/repo", () => ({
  findUserInGarage: vi.fn(),
  listUsersByGarage: vi.fn(),
  listInvitesByGarage: vi.fn(),
  createInvite: vi.fn(),
  findPendingInviteInGarage: vi.fn(),
  findGarageName: vi.fn(),
  refreshInviteToken: vi.fn(),
  updateInviteEmailStatus: vi.fn().mockResolvedValue({ count: 1 }),
  deleteInviteInGarage: vi.fn(),
  updateUserRoleInGarage: vi.fn(),
  deleteUserInGarage: vi.fn(),
}));

import { writeAuditLog } from "@/lib/audit";
import { sendLoggedEmail } from "@/lib/email";
import { findUserByEmailForLogin } from "@/modules/auth/repo";
import {
  createInvite,
  deleteInviteInGarage,
  deleteUserInGarage,
  findGarageName,
  findPendingInviteInGarage,
  findUserInGarage,
  refreshInviteToken,
  updateInviteEmailStatus,
  updateUserRoleInGarage,
} from "@/modules/team/repo";
import {
  changeMemberRole,
  inviteTeamMember,
  removeMember,
  resendInvite,
  revokeInvite,
} from "@/modules/team/service";

const garageA = "garage-a";
const garageB = "garage-b";

const ownerA: RoleSession = {
  userId: "owner-a",
  garageId: garageA,
  role: "OWNER",
};

const managerA: RoleSession = {
  userId: "manager-a",
  garageId: garageA,
  role: "MANAGER",
};

describe("team management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findGarageName).mockResolvedValue({
      id: garageA,
      name: "Garage A",
    });
    vi.mocked(sendLoggedEmail).mockResolvedValue({
      ok: true,
      provider: "fake",
      requestId: "req-1",
    });
  });

  it("sends invite email and does not report success on send failure", async () => {
    vi.mocked(findUserByEmailForLogin).mockResolvedValue(null);
    vi.mocked(createInvite).mockResolvedValue({
      id: "inv-1",
      email: "tech@example.com",
      role: "TECHNICIAN",
      expiresAt: new Date(Date.now() + 86_400_000),
      garageId: garageA,
      tokenHash: "hash:x",
      invitedBy: ownerA.userId,
      locale: "en",
      acceptedAt: null,
      lastEmailStatus: null,
      lastEmailAt: null,
      lastEmailError: null,
      createdAt: new Date(),
    });

    await inviteTeamMember(
      ownerA,
      { email: "tech@example.com", role: "TECHNICIAN" },
      { locale: "en" },
    );

    expect(sendLoggedEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "team_invite",
        to: "tech@example.com",
      }),
    );
    expect(updateInviteEmailStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: "sent" }),
    );

    vi.mocked(createInvite).mockResolvedValue({
      id: "inv-2",
      email: "tech2@example.com",
      role: "MANAGER",
      expiresAt: new Date(Date.now() + 86_400_000),
      garageId: garageA,
      tokenHash: "hash:y",
      invitedBy: ownerA.userId,
      locale: "en",
      acceptedAt: null,
      lastEmailStatus: null,
      lastEmailAt: null,
      lastEmailError: null,
      createdAt: new Date(),
    });
    vi.mocked(sendLoggedEmail).mockResolvedValue({
      ok: false,
      provider: "fake",
      errorCode: "RESEND_ERROR",
    });

    await expect(
      inviteTeamMember(
        ownerA,
        { email: "tech2@example.com", role: "MANAGER" },
        { locale: "en" },
      ),
    ).rejects.toMatchObject({ code: "team.email_send_failed" });
    expect(updateInviteEmailStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" }),
    );
  });

  it("resends invite email only for the session garage", async () => {
    vi.mocked(findPendingInviteInGarage).mockResolvedValue({
      id: "inv-1",
      email: "tech@example.com",
      role: "TECHNICIAN",
      expiresAt: new Date(Date.now() + 86_400_000),
      createdAt: new Date(),
      locale: "en",
      lastEmailStatus: "sent",
      lastEmailAt: new Date(),
    });
    vi.mocked(findUserByEmailForLogin).mockResolvedValue(null);
    vi.mocked(refreshInviteToken).mockResolvedValue({ count: 1 });

    const result = await resendInvite(ownerA, { inviteId: "inv-1" });

    expect(findPendingInviteInGarage).toHaveBeenCalledWith(garageA, "inv-1");
    expect(sendLoggedEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "team_invite",
        to: "tech@example.com",
      }),
    );
    expect(result.invite.lastEmailStatus).toBe("sent");
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        garageId: garageA,
        action: "invite.resent",
      }),
    );
  });

  it("denies resend for non-owners", async () => {
    await expect(
      resendInvite(managerA, { inviteId: "inv-1" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(findPendingInviteInGarage).not.toHaveBeenCalled();
  });

  it("revokes invite scoped to garage", async () => {
    vi.mocked(findPendingInviteInGarage).mockResolvedValue({
      id: "inv-1",
      email: "tech@example.com",
      role: "TECHNICIAN",
      expiresAt: new Date(),
      createdAt: new Date(),
      locale: "en",
      lastEmailStatus: "sent",
      lastEmailAt: new Date(),
    });
    vi.mocked(deleteInviteInGarage).mockResolvedValue({ count: 1 });

    await revokeInvite(ownerA, { inviteId: "inv-1" });

    expect(deleteInviteInGarage).toHaveBeenCalledWith(garageA, "inv-1");
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "invite.revoked", garageId: garageA }),
    );
  });

  it("changes member role and audits", async () => {
    vi.mocked(findUserInGarage).mockResolvedValue({
      id: "tech-1",
      email: "tech@example.com",
      name: "Tech",
      role: "TECHNICIAN",
      garageId: garageA,
    });
    vi.mocked(updateUserRoleInGarage).mockResolvedValue({ count: 1 });

    await changeMemberRole(ownerA, {
      userId: "tech-1",
      role: "MANAGER",
    });

    expect(updateUserRoleInGarage).toHaveBeenCalledWith({
      garageId: garageA,
      userId: "tech-1",
      role: "MANAGER",
    });
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "user.role_changed",
        meta: expect.objectContaining({
          fromRole: "TECHNICIAN",
          toRole: "MANAGER",
        }),
      }),
    );
  });

  it("blocks changing own role or the owner", async () => {
    await expect(
      changeMemberRole(ownerA, { userId: ownerA.userId, role: "MANAGER" }),
    ).rejects.toMatchObject({
      code: "team.cannot_change_self",
    } satisfies Partial<AppError>);

    vi.mocked(findUserInGarage).mockResolvedValue({
      id: "other-owner",
      email: "o2@example.com",
      name: "O2",
      role: "OWNER",
      garageId: garageA,
    });

    await expect(
      changeMemberRole(ownerA, { userId: "other-owner", role: "MANAGER" }),
    ).rejects.toMatchObject({ code: "team.cannot_change_owner" });
  });

  it("removes a member from the session garage only", async () => {
    vi.mocked(findUserInGarage).mockResolvedValue({
      id: "tech-1",
      email: "tech@example.com",
      name: "Tech",
      role: "TECHNICIAN",
      garageId: garageA,
    });
    vi.mocked(deleteUserInGarage).mockResolvedValue({ count: 1 });

    await removeMember(ownerA, { userId: "tech-1" });

    expect(deleteUserInGarage).toHaveBeenCalledWith(garageA, "tech-1");
    expect(deleteUserInGarage).not.toHaveBeenCalledWith(garageB, expect.anything());
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "user.removed", garageId: garageA }),
    );
  });

  it("returns not found when invite is missing", async () => {
    vi.mocked(findPendingInviteInGarage).mockResolvedValue(null);
    await expect(
      resendInvite(ownerA, { inviteId: "missing" }),
    ).rejects.toMatchObject({ code: "team.not_found" } satisfies Partial<AppError>);
  });
});

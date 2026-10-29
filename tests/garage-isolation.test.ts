import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError } from "@/lib/errors";
import { requireRole, type RoleSession } from "@/lib/rbac";

vi.mock("@/lib/audit", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined) }));

vi.mock("@/lib/otp", () => ({
  hashToken: vi.fn((token: string) => `hash:${token}`) }));

vi.mock("@/modules/auth/repo", () => ({
  findUserByEmailForLogin: vi.fn() }));

vi.mock("@/modules/settings/repo", () => ({
  findGarageById: vi.fn(),
  updateGarageById: vi.fn() }));

vi.mock("@/modules/team/repo", () => ({
  findUserInGarage: vi.fn(),
  listUsersByGarage: vi.fn(),
  listInvitesByGarage: vi.fn(),
  createInvite: vi.fn(),
  findPendingInviteInGarage: vi.fn(),
  refreshInviteToken: vi.fn(),
  deleteInviteInGarage: vi.fn(),
  updateUserRoleInGarage: vi.fn(),
  deleteUserInGarage: vi.fn() }));

import { writeAuditLog } from "@/lib/audit";
import {
  findGarageById,
  updateGarageById } from "@/modules/settings/repo";
import { findUserInGarage } from "@/modules/team/repo";
import {
  getGarageSettings,
  getGarageSettingsForGarageId,
  updateGarageSettings,
  updateGarageSettingsForGarageId } from "@/modules/settings/service";
import { getTeamMemberForGarage } from "@/modules/team/service";

const garageA = "garage-a";
const garageB = "garage-b";

const ownerA: RoleSession & { email: string; name: string } = {
  userId: "user-a",
  garageId: garageA,
  role: "OWNER",
  email: "owner-a@example.com",
  name: "Owner A" };

const ownerB: RoleSession & { email: string; name: string } = {
  userId: "user-b",
  garageId: garageB,
  role: "OWNER",
  email: "owner-b@example.com",
  name: "Owner B" };

describe("garage isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads only the session garage, never a body garageId", async () => {
    vi.mocked(findGarageById).mockResolvedValue({
      id: garageA,
      name: "Alpha Motors",
      address: null,
      gstin: null,
      updatedAt: new Date() });

    const garage = await getGarageSettings(ownerA);

    expect(findGarageById).toHaveBeenCalledWith(garageA);
    expect(findGarageById).not.toHaveBeenCalledWith(garageB);
    expect(garage.id).toBe(garageA);
  });

  it("rejects reading another garage's records", async () => {
    await expect(
      getGarageSettingsForGarageId(ownerA, garageB),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(findGarageById).not.toHaveBeenCalled();
  });

  it("updates only the session garage even if another id is requested", async () => {
    vi.mocked(updateGarageById).mockResolvedValue({
      id: garageA,
      name: "Alpha Updated",
      address: "Ring Road",
      gstin: "24AAAAA0000A1Z5",
      updatedAt: new Date() });

    await expect(
      updateGarageSettingsForGarageId(ownerA, garageB, {
        name: "Hacked Name",
        address: "Elsewhere",
        gstin: "24AAAAA0000A1Z5" }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(updateGarageById).not.toHaveBeenCalled();
    expect(writeAuditLog).not.toHaveBeenCalled();
  });

  it("persists settings against the session garageId only", async () => {
    vi.mocked(updateGarageById).mockResolvedValue({
      id: garageA,
      name: "Alpha Updated",
      address: "Ring Road",
      gstin: "24AAAAA0000A1Z5",
      updatedAt: new Date() });

    const updated = await updateGarageSettings(ownerA, {
      name: "Alpha Updated",
      address: "Ring Road",
      gstin: "24AAAAA0000A1Z5" });

    expect(updateGarageById).toHaveBeenCalledWith(garageA, {
      name: "Alpha Updated",
      address: "Ring Road",
      gstin: "24AAAAA0000A1Z5" });
    expect(updateGarageById).not.toHaveBeenCalledWith(
      garageB,
      expect.anything(),
    );
    expect(updated.id).toBe(garageA);
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ garageId: garageA, actorId: ownerA.userId }),
    );
  });

  it("denies reading a teammate that belongs to another garage", async () => {
    await expect(
      getTeamMemberForGarage(ownerA, garageB, ownerB.userId),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(findUserInGarage).not.toHaveBeenCalled();
  });

  it("scopes teammate reads to the session garage", async () => {
    vi.mocked(findUserInGarage).mockResolvedValue({
      id: "tech-a",
      email: "tech@example.com",
      name: "Tech",
      role: "TECHNICIAN",
      garageId: garageA });

    const member = await getTeamMemberForGarage(ownerA, garageA, "tech-a");

    expect(findUserInGarage).toHaveBeenCalledWith(garageA, "tech-a");
    expect(member?.garageId).toBe(garageA);
  });
});

describe("requireRole", () => {
  it("allows listed roles", () => {
    expect(requireRole(ownerA, ["OWNER", "MANAGER"]).userId).toBe("user-a");
  });

  it("blocks roles outside the allow-list", () => {
    const technician = {
      ...ownerA,
      role: "TECHNICIAN" as const };
    expect(() => requireRole(technician, ["OWNER"])).toThrow(ForbiddenError);
  });
});

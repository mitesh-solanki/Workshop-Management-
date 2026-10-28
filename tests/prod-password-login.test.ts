import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

vi.mock("@/lib/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limit")>(
    "@/lib/rate-limit",
  );
  return {
    ...actual,
    consumeRateLimit: vi.fn().mockResolvedValue({
      allowed: true,
      remaining: 10,
      resetAt: new Date(Date.now() + 60_000),
    }),
  };
});

vi.mock("@/modules/auth/repo", () => ({
  findUserByEmailForLogin: vi.fn(),
  createOwnerWithGarage: vi.fn(),
  ensureTechnicianInGarage: vi.fn(),
  invalidateOpenEmailOtps: vi.fn(),
  createEmailOtpRow: vi.fn(),
  findLatestEmailOtp: vi.fn(),
  incrementEmailOtpAttempts: vi.fn(),
  markEmailOtpConsumed: vi.fn(),
  findPendingInviteByEmail: vi.fn(),
  findPendingInviteByTokenHash: vi.fn(),
  acceptInviteAndCreateUser: vi.fn(),
  createPrismaAuthAdapter: vi.fn(),
  findUserByIdForSessionRefresh: vi.fn(),
  findOpenEmailOtps: vi.fn(),
}));

import {
  completeProdPasswordSignIn,
  isProdPasswordLoginEnabled,
} from "@/modules/auth/service";
import {
  createOwnerWithGarage,
  ensureTechnicianInGarage,
  findUserByEmailForLogin,
} from "@/modules/auth/repo";

describe("production password login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_PROD_EMAIL", "owner@primemotors.in");
    vi.stubEnv("AUTH_PROD_PASSWORD", "Workshop@123");
    vi.stubEnv("AUTH_PROD_NAME", "Prime Motors Owner");
    vi.stubEnv("AUTH_PROD_GARAGE_NAME", "Prime Motors");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is enabled only in production with env credentials", () => {
    expect(isProdPasswordLoginEnabled()).toBe(true);

    vi.stubEnv("NODE_ENV", "development");
    expect(isProdPasswordLoginEnabled()).toBe(false);

    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_PROD_PASSWORD", "");
    expect(isProdPasswordLoginEnabled()).toBe(false);
  });

  it("rejects outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    await expect(
      completeProdPasswordSignIn({
        email: "owner@primemotors.in",
        password: "Workshop@123",
      }),
    ).rejects.toMatchObject({ code: "auth.invalid_credentials" } satisfies Partial<AppError>);
  });

  it("rejects wrong password", async () => {
    await expect(
      completeProdPasswordSignIn({
        email: "owner@primemotors.in",
        password: "wrong",
      }),
    ).rejects.toMatchObject({ code: "auth.invalid_credentials" });
    expect(findUserByEmailForLogin).not.toHaveBeenCalled();
  });

  it("rejects wrong email even with correct password", async () => {
    await expect(
      completeProdPasswordSignIn({
        email: "other@example.com",
        password: "Workshop@123",
      }),
    ).rejects.toMatchObject({ code: "auth.invalid_credentials" });
    expect(findUserByEmailForLogin).not.toHaveBeenCalled();
  });

  it("signs in an existing user", async () => {
    const user = {
      id: "u1",
      email: "owner@primemotors.in",
      name: "Prime Motors Owner",
      garageId: "g1",
      role: "OWNER" as const,
      emailVerified: new Date(),
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(findUserByEmailForLogin).mockResolvedValue(user);
    vi.mocked(ensureTechnicianInGarage).mockResolvedValue({
      id: "tech-1",
      email: "mechanic@primemotors.in",
      name: "Demo Mechanic",
      garageId: "g1",
      role: "TECHNICIAN",
      emailVerified: new Date(),
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await completeProdPasswordSignIn({
      email: "Owner@PrimeMotors.in",
      password: "Workshop@123",
    });

    expect(result).toEqual(user);
    expect(createOwnerWithGarage).not.toHaveBeenCalled();
    expect(ensureTechnicianInGarage).toHaveBeenCalledWith({
      garageId: "g1",
      email: "mechanic@primemotors.in",
      name: "Demo Mechanic",
      actorId: "u1",
    });
  });

  it("creates owner and garage on first sign-in", async () => {
    vi.mocked(findUserByEmailForLogin).mockResolvedValue(null);
    const created = {
      user: {
        id: "u2",
        email: "owner@primemotors.in",
        name: "Prime Motors Owner",
        garageId: "g2",
        role: "OWNER" as const,
        emailVerified: new Date(),
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      garage: { id: "g2", name: "Prime Motors" },
    };
    vi.mocked(createOwnerWithGarage).mockResolvedValue(created as never);
    vi.mocked(ensureTechnicianInGarage).mockResolvedValue({
      id: "tech-2",
      email: "mechanic@primemotors.in",
      name: "Demo Mechanic",
      garageId: "g2",
      role: "TECHNICIAN",
      emailVerified: new Date(),
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await completeProdPasswordSignIn({
      email: "owner@primemotors.in",
      password: "Workshop@123",
    });

    expect(createOwnerWithGarage).toHaveBeenCalledWith({
      email: "owner@primemotors.in",
      name: "Prime Motors Owner",
      garageName: "Prime Motors",
    });
    expect(ensureTechnicianInGarage).toHaveBeenCalledWith({
      garageId: "g2",
      email: "mechanic@primemotors.in",
      name: "Demo Mechanic",
      actorId: "u2",
    });
    expect(result).toEqual(created.user);
  });

  it("signs in the dummy mechanic with the owner password by default", async () => {
    const owner = {
      id: "u1",
      email: "owner@primemotors.in",
      name: "Prime Motors Owner",
      garageId: "g1",
      role: "OWNER" as const,
      emailVerified: new Date(),
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const tech = {
      id: "tech-1",
      email: "mechanic@primemotors.in",
      name: "Demo Mechanic",
      garageId: "g1",
      role: "TECHNICIAN" as const,
      emailVerified: new Date(),
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(findUserByEmailForLogin).mockResolvedValueOnce(null);
    vi.mocked(findUserByEmailForLogin).mockResolvedValueOnce(owner);
    vi.mocked(ensureTechnicianInGarage).mockResolvedValue(tech);

    const result = await completeProdPasswordSignIn({
      email: "mechanic@primemotors.in",
      password: "Workshop@123",
    });

    expect(ensureTechnicianInGarage).toHaveBeenCalledWith({
      garageId: "g1",
      email: "mechanic@primemotors.in",
      name: "Demo Mechanic",
      actorId: "u1",
    });
    expect(result).toEqual(tech);
  });

  it("rejects mechanic login when the owner garage does not exist yet", async () => {
    vi.mocked(findUserByEmailForLogin).mockResolvedValue(null);

    await expect(
      completeProdPasswordSignIn({
        email: "mechanic@primemotors.in",
        password: "Workshop@123",
      }),
    ).rejects.toMatchObject({ code: "auth.invalid_credentials" });
    expect(ensureTechnicianInGarage).not.toHaveBeenCalled();
  });
});

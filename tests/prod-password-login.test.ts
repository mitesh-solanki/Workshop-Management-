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

    const result = await completeProdPasswordSignIn({
      email: "Owner@PrimeMotors.in",
      password: "Workshop@123",
    });

    expect(result).toEqual(user);
    expect(createOwnerWithGarage).not.toHaveBeenCalled();
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

    const result = await completeProdPasswordSignIn({
      email: "owner@primemotors.in",
      password: "Workshop@123",
    });

    expect(createOwnerWithGarage).toHaveBeenCalledWith({
      email: "owner@primemotors.in",
      name: "Prime Motors Owner",
      garageName: "Prime Motors",
    });
    expect(result).toEqual(created.user);
  });
});

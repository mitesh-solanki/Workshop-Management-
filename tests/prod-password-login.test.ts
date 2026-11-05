import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@/lib/password", async () => {
  const actual = await vi.importActual<typeof import("@/lib/password")>(
    "@/lib/password",
  );
  return {
    ...actual,
    hashPassword: vi.fn(async (password: string) => `hash:${password}`),
    verifyPassword: vi.fn(
      async (password: string, passwordHash: string) =>
        passwordHash === `hash:${password}`,
    ),
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
  setUserPasswordHash: vi.fn(),
  recordFailedLogin: vi.fn(),
  clearLoginFailures: vi.fn(),
  setPasswordResetToken: vi.fn(),
  findUserByPasswordResetTokenHash: vi.fn(),
}));

import { LOGIN_LOCKOUT_ATTEMPTS } from "@/lib/password";
import { consumeRateLimit } from "@/lib/rate-limit";
import {
  completePasswordSignIn,
  isPasswordLoginEnabled,
} from "@/modules/auth/service";
import {
  clearLoginFailures,
  createOwnerWithGarage,
  ensureTechnicianInGarage,
  findUserByEmailForLogin,
  recordFailedLogin,
  setUserPasswordHash,
} from "@/modules/auth/repo";

function baseUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "u1",
    email: "owner@primemotors.in",
    name: "Prime Motors Owner",
    garageId: "g1",
    role: "OWNER" as const,
    emailVerified: new Date(),
    image: null,
    passwordHash: null as string | null,
    isActive: true,
    passwordResetTokenHash: null,
    passwordResetExpiresAt: null,
    failedLoginAttempts: 0,
    lockoutUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("password login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("AUTH_PROD_EMAIL", "owner@primemotors.in");
    vi.stubEnv("AUTH_PROD_PASSWORD", "Workshop@123");
    vi.stubEnv("AUTH_PROD_NAME", "Prime Motors Owner");
    vi.stubEnv("AUTH_PROD_GARAGE_NAME", "Prime Motors");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is always enabled for staff password login", () => {
    expect(isPasswordLoginEnabled()).toBe(true);
    vi.stubEnv("NODE_ENV", "development");
    expect(isPasswordLoginEnabled()).toBe(true);
  });

  it("signs in with a stored password hash", async () => {
    const user = baseUser({ passwordHash: "hash:Secret@1" });
    vi.mocked(findUserByEmailForLogin).mockResolvedValue(user);

    const result = await completePasswordSignIn({
      email: "owner@primemotors.in",
      password: "Secret@1",
    });

    expect(result).toEqual(user);
    expect(clearLoginFailures).toHaveBeenCalledWith("u1");
    expect(createOwnerWithGarage).not.toHaveBeenCalled();
  });

  it("rejects wrong stored password and records a failed attempt", async () => {
    const user = baseUser({
      passwordHash: "hash:Secret@1",
      failedLoginAttempts: 1,
    });
    vi.mocked(findUserByEmailForLogin).mockResolvedValue(user);
    vi.mocked(recordFailedLogin).mockResolvedValue(user as never);

    await expect(
      completePasswordSignIn({
        email: "owner@primemotors.in",
        password: "Wrong@1",
      }),
    ).rejects.toMatchObject({ code: "auth.invalid_credentials" });
    expect(recordFailedLogin).toHaveBeenCalledWith("u1", null);
    expect(clearLoginFailures).not.toHaveBeenCalled();
  });

  it(`locks the account after ${LOGIN_LOCKOUT_ATTEMPTS} wrong passwords`, async () => {
    const user = baseUser({
      passwordHash: "hash:Secret@1",
      failedLoginAttempts: LOGIN_LOCKOUT_ATTEMPTS - 1,
    });
    vi.mocked(findUserByEmailForLogin).mockResolvedValue(user);
    vi.mocked(recordFailedLogin).mockResolvedValue(user as never);

    await expect(
      completePasswordSignIn({
        email: "owner@primemotors.in",
        password: "Wrong@1",
      }),
    ).rejects.toMatchObject({ code: "auth.invalid_credentials" });

    expect(recordFailedLogin).toHaveBeenCalledWith(
      "u1",
      expect.any(Date),
    );
    const lockoutUntil = vi.mocked(recordFailedLogin).mock.calls[0]?.[1];
    expect(lockoutUntil).toBeInstanceOf(Date);
    expect((lockoutUntil as Date).getTime()).toBeGreaterThan(Date.now());
  });

  it("rejects login while lockout is active", async () => {
    const user = baseUser({
      passwordHash: "hash:Secret@1",
      failedLoginAttempts: LOGIN_LOCKOUT_ATTEMPTS,
      lockoutUntil: new Date(Date.now() + 10 * 60 * 1000),
    });
    vi.mocked(findUserByEmailForLogin).mockResolvedValue(user);

    await expect(
      completePasswordSignIn({
        email: "owner@primemotors.in",
        password: "Secret@1",
      }),
    ).rejects.toMatchObject({ code: "auth.rate_limited" });
    expect(recordFailedLogin).not.toHaveBeenCalled();
    expect(clearLoginFailures).not.toHaveBeenCalled();
  });

  it("clears failed attempts after a successful password login", async () => {
    const user = baseUser({
      passwordHash: "hash:Secret@1",
      failedLoginAttempts: 3,
    });
    vi.mocked(findUserByEmailForLogin).mockResolvedValue(user);

    await completePasswordSignIn({
      email: "owner@primemotors.in",
      password: "Secret@1",
    });

    expect(clearLoginFailures).toHaveBeenCalledWith("u1");
  });

  it("rejects when password rate limit is exceeded", async () => {
    vi.mocked(consumeRateLimit).mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + 60_000),
    });

    await expect(
      completePasswordSignIn({
        email: "owner@primemotors.in",
        password: "Secret@1",
      }),
    ).rejects.toMatchObject({ code: "auth.rate_limited" });
    expect(findUserByEmailForLogin).not.toHaveBeenCalled();
  });

  it("rejects inactive users without counting a password attempt", async () => {
    const user = baseUser({
      passwordHash: "hash:Secret@1",
      isActive: false,
    });
    vi.mocked(findUserByEmailForLogin).mockResolvedValue(user);

    await expect(
      completePasswordSignIn({
        email: "owner@primemotors.in",
        password: "Secret@1",
      }),
    ).rejects.toMatchObject({ code: "auth.invalid_credentials" });
    expect(recordFailedLogin).not.toHaveBeenCalled();
  });

  it("bootstraps owner from AUTH_PROD_* on first login", async () => {
    vi.mocked(findUserByEmailForLogin).mockResolvedValue(null);
    const created = {
      user: baseUser({ id: "u2", garageId: "g2" }),
      garage: { id: "g2", name: "Prime Motors" },
    };
    vi.mocked(createOwnerWithGarage).mockResolvedValue(created as never);
    vi.mocked(ensureTechnicianInGarage).mockResolvedValue(
      baseUser({
        id: "tech-2",
        email: "mechanic@primemotors.in",
        role: "TECHNICIAN",
        garageId: "g2",
      }) as never,
    );

    const result = await completePasswordSignIn({
      email: "owner@primemotors.in",
      password: "Workshop@123",
    });

    expect(createOwnerWithGarage).toHaveBeenCalledWith({
      email: "owner@primemotors.in",
      name: "Prime Motors Owner",
      garageName: "Prime Motors",
      passwordHash: "hash:Workshop@123",
    });
    expect(ensureTechnicianInGarage).toHaveBeenCalledWith(
      expect.objectContaining({
        garageId: "g2",
        email: "mechanic@primemotors.in",
        passwordHash: "hash:Workshop@123",
      }),
    );
    expect(result).toEqual(created.user);
  });

  it("syncs hash when bootstrap owner already exists without password", async () => {
    const user = baseUser({ passwordHash: null });
    vi.mocked(findUserByEmailForLogin).mockResolvedValue(user);
    vi.mocked(setUserPasswordHash).mockResolvedValue(user as never);
    vi.mocked(ensureTechnicianInGarage).mockResolvedValue(
      baseUser({
        id: "tech-1",
        email: "mechanic@primemotors.in",
        role: "TECHNICIAN",
      }) as never,
    );

    const result = await completePasswordSignIn({
      email: "Owner@PrimeMotors.in",
      password: "Workshop@123",
    });

    expect(setUserPasswordHash).toHaveBeenCalledWith(
      "u1",
      "hash:Workshop@123",
    );
    expect(result.email).toBe("owner@primemotors.in");
  });

  it("rejects mechanic login when the owner garage does not exist yet", async () => {
    vi.mocked(findUserByEmailForLogin).mockResolvedValue(null);

    await expect(
      completePasswordSignIn({
        email: "mechanic@primemotors.in",
        password: "Workshop@123",
      }),
    ).rejects.toMatchObject({ code: "auth.invalid_credentials" });
    expect(ensureTechnicianInGarage).not.toHaveBeenCalled();
  });
});

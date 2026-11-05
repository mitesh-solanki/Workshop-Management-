import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

vi.mock("@/lib/audit", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

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
  findUserByPasswordResetTokenHash: vi.fn(),
  findUserByIdForPasswordChange: vi.fn(),
  setUserPasswordHash: vi.fn(),
  updateOwnNameInGarage: vi.fn(),
}));

import { writeAuditLog } from "@/lib/audit";
import {
  changeOwnName,
  changeOwnPassword,
  resetPasswordWithToken,
} from "@/modules/auth/service";
import {
  findUserByIdForPasswordChange,
  findUserByPasswordResetTokenHash,
  setUserPasswordHash,
  updateOwnNameInGarage,
} from "@/modules/auth/repo";

const resetToken = "abcdefghijklmnop";

describe("password change and reset reuse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects reset when the new password matches the current one", async () => {
    vi.mocked(findUserByPasswordResetTokenHash).mockResolvedValue({
      id: "u1",
      email: "tech@example.com",
      passwordHash: "hash:Secret1!",
    } as never);

    await expect(
      resetPasswordWithToken({
        token: resetToken,
        password: "Secret1!",
        confirmPassword: "Secret1!",
      }),
    ).rejects.toMatchObject({
      code: "auth.password_reuse",
    } satisfies Partial<AppError>);
    expect(setUserPasswordHash).not.toHaveBeenCalled();
  });

  it("allows reset when the new password is different", async () => {
    vi.mocked(findUserByPasswordResetTokenHash).mockResolvedValue({
      id: "u1",
      email: "tech@example.com",
      passwordHash: "hash:OldPass1!",
    } as never);
    vi.mocked(setUserPasswordHash).mockResolvedValue({} as never);

    const result = await resetPasswordWithToken({
      token: resetToken,
      password: "NewPass1!",
      confirmPassword: "NewPass1!",
    });

    expect(result.email).toBe("tech@example.com");
    expect(setUserPasswordHash).toHaveBeenCalledWith("u1", "hash:NewPass1!");
  });

  it("rejects change-own when current password is wrong", async () => {
    vi.mocked(findUserByIdForPasswordChange).mockResolvedValue({
      id: "u1",
      garageId: "g1",
      isActive: true,
      passwordHash: "hash:Secret1!",
    });

    await expect(
      changeOwnPassword(
        { userId: "u1", garageId: "g1" },
        {
          currentPassword: "WrongPass1!",
          password: "NewPass1!",
          confirmPassword: "NewPass1!",
        },
      ),
    ).rejects.toMatchObject({
      code: "auth.wrong_current_password",
    } satisfies Partial<AppError>);
  });

  it("rejects change-own when new password matches current", async () => {
    vi.mocked(findUserByIdForPasswordChange).mockResolvedValue({
      id: "u1",
      garageId: "g1",
      isActive: true,
      passwordHash: "hash:Secret1!",
    });

    await expect(
      changeOwnPassword(
        { userId: "u1", garageId: "g1" },
        {
          currentPassword: "Secret1!",
          password: "Secret1!",
          confirmPassword: "Secret1!",
        },
      ),
    ).rejects.toMatchObject({
      code: "auth.password_reuse",
    } satisfies Partial<AppError>);
    expect(setUserPasswordHash).not.toHaveBeenCalled();
  });

  it("changes own password and audits", async () => {
    vi.mocked(findUserByIdForPasswordChange).mockResolvedValue({
      id: "u1",
      garageId: "g1",
      isActive: true,
      passwordHash: "hash:Secret1!",
    });
    vi.mocked(setUserPasswordHash).mockResolvedValue({} as never);

    await changeOwnPassword(
      { userId: "u1", garageId: "g1" },
      {
        currentPassword: "Secret1!",
        password: "NewPass1!",
        confirmPassword: "NewPass1!",
      },
    );

    expect(setUserPasswordHash).toHaveBeenCalledWith("u1", "hash:NewPass1!");
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "user.password_changed",
        garageId: "g1",
        actorId: "u1",
      }),
    );
  });

  it("updates own name and audits", async () => {
    vi.mocked(updateOwnNameInGarage).mockResolvedValue({ count: 1 });

    const result = await changeOwnName(
      { userId: "u1", garageId: "g1" },
      { name: "Ravi Patel" },
    );

    expect(result.name).toBe("Ravi Patel");
    expect(updateOwnNameInGarage).toHaveBeenCalledWith({
      garageId: "g1",
      userId: "u1",
      name: "Ravi Patel",
    });
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "user.name_changed",
        garageId: "g1",
        actorId: "u1",
      }),
    );
  });
});

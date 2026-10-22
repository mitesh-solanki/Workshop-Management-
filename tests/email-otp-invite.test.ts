import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import type { EmailProvider, SendEmailInput, SendEmailResult } from "@/lib/email/types";
import { renderInviteEmail } from "@/lib/email/templates/invite";
import { renderOtpEmail } from "@/lib/email/templates/otp";
import { MAX_OTP_ATTEMPTS } from "@/lib/rate-limit";

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

vi.mock("@/lib/email/send", () => ({
  sendLoggedEmail: vi.fn(),
}));

vi.mock("@/modules/auth/repo", () => ({
  invalidateOpenEmailOtps: vi.fn().mockResolvedValue({ count: 0 }),
  createEmailOtpRow: vi.fn().mockResolvedValue({ id: "otp-1" }),
  findLatestEmailOtp: vi.fn(),
  incrementEmailOtpAttempts: vi.fn(),
  markEmailOtpConsumed: vi.fn().mockResolvedValue({}),
  findUserByEmailForLogin: vi.fn(),
  findPendingInviteByEmail: vi.fn(),
  findPendingInviteByTokenHash: vi.fn(),
  createOwnerWithGarage: vi.fn(),
  acceptInviteAndCreateUser: vi.fn(),
  createPrismaAuthAdapter: vi.fn(),
  findUserByIdForSessionRefresh: vi.fn(),
  findOpenEmailOtps: vi.fn(),
}));

vi.mock("@/lib/otp", async () => {
  const actual = await vi.importActual<typeof import("@/lib/otp")>("@/lib/otp");
  return {
    ...actual,
    generateOtpCode: vi.fn(() => "424242"),
    hashOtpCode: vi.fn(async (code: string) => `hash:${code}`),
    compareOtpCode: vi.fn(
      async (code: string, codeHash: string) => codeHash === `hash:${code}`,
    ),
  };
});

import { sendLoggedEmail } from "@/lib/email/send";
import {
  consumeEmailOtp,
  createEmailOtp,
  inviteAcceptUrl,
} from "@/modules/auth/service";
import {
  createEmailOtpRow,
  findLatestEmailOtp,
  findPendingInviteByTokenHash,
  incrementEmailOtpAttempts,
  markEmailOtpConsumed,
} from "@/modules/auth/repo";
import { consumeRateLimit } from "@/lib/rate-limit";

function makeFakeProvider(result: SendEmailResult = { ok: true, provider: "fake", requestId: "req-1" }) {
  const sent: SendEmailInput[] = [];
  const provider: EmailProvider = {
    name: "fake",
    async sendEmail(input) {
      sent.push(input);
      return result;
    },
  };
  return { provider, sent };
}

describe("OTP email delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sendLoggedEmail).mockResolvedValue({
      ok: true,
      provider: "fake",
      requestId: "req-1",
    });
    vi.mocked(consumeRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 10,
      resetAt: new Date(Date.now() + 60_000),
    });
  });

  it("sends one OTP email per request and never returns the code", async () => {
    const result = await createEmailOtp({
      email: "owner@example.com",
      purpose: "login",
      locale: "en",
    });

    expect(result).toEqual({
      email: "owner@example.com",
      expiresInSeconds: 600,
    });
    expect(result).not.toHaveProperty("code");
    expect(createEmailOtpRow).toHaveBeenCalledTimes(1);
    expect(sendLoggedEmail).toHaveBeenCalledTimes(1);
    expect(sendLoggedEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "login_otp",
        to: "owner@example.com",
        subject: expect.any(String),
        html: expect.stringContaining("424242"),
        text: expect.stringContaining("424242"),
      }),
    );
  });

  it("surfaces send failure without exposing provider errors", async () => {
    vi.mocked(sendLoggedEmail).mockResolvedValue({
      ok: false,
      provider: "fake",
      errorCode: "RESEND_ERROR",
    });

    await expect(
      createEmailOtp({ email: "a@b.com", purpose: "login" }),
    ).rejects.toMatchObject({ code: "auth.email_send_failed" } satisfies Partial<AppError>);
  });

  it("rejects wrong, expired and reused codes", async () => {
    vi.mocked(findLatestEmailOtp).mockResolvedValue({
      id: "otp-1",
      email: "a@b.com",
      codeHash: "hash:424242",
      purpose: "login",
      payload: null,
      attempts: 0,
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      createdAt: new Date(),
    });
    vi.mocked(incrementEmailOtpAttempts).mockResolvedValue({
      id: "otp-1",
      email: "a@b.com",
      codeHash: "hash:424242",
      purpose: "login",
      payload: null,
      attempts: 1,
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      createdAt: new Date(),
    });

    await expect(
      consumeEmailOtp({ email: "a@b.com", code: "000000" }),
    ).rejects.toMatchObject({ code: "auth.invalid_otp" });
    expect(incrementEmailOtpAttempts).toHaveBeenCalledWith("otp-1");

    vi.mocked(findLatestEmailOtp).mockResolvedValue({
      id: "otp-2",
      email: "a@b.com",
      codeHash: "hash:424242",
      purpose: "login",
      payload: null,
      attempts: 0,
      expiresAt: new Date(Date.now() - 1000),
      consumedAt: null,
      createdAt: new Date(),
    });
    await expect(
      consumeEmailOtp({ email: "a@b.com", code: "424242" }),
    ).rejects.toMatchObject({ code: "auth.invalid_otp" });

    vi.mocked(findLatestEmailOtp).mockResolvedValue({
      id: "otp-3",
      email: "a@b.com",
      codeHash: "hash:424242",
      purpose: "login",
      payload: null,
      attempts: 0,
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: new Date(),
      createdAt: new Date(),
    });
    await expect(
      consumeEmailOtp({ email: "a@b.com", code: "424242" }),
    ).rejects.toMatchObject({ code: "auth.invalid_otp" });
  });

  it("enforces max wrong attempts per code", async () => {
    vi.mocked(findLatestEmailOtp).mockResolvedValue({
      id: "otp-4",
      email: "a@b.com",
      codeHash: "hash:424242",
      purpose: "login",
      payload: null,
      attempts: MAX_OTP_ATTEMPTS - 1,
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      createdAt: new Date(),
    });
    vi.mocked(incrementEmailOtpAttempts).mockResolvedValue({
      id: "otp-4",
      email: "a@b.com",
      codeHash: "hash:424242",
      purpose: "login",
      payload: null,
      attempts: MAX_OTP_ATTEMPTS,
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      createdAt: new Date(),
    });

    await expect(
      consumeEmailOtp({ email: "a@b.com", code: "111111" }),
    ).rejects.toMatchObject({ code: "auth.invalid_otp" });
    expect(markEmailOtpConsumed).toHaveBeenCalledWith("otp-4");
  });

  it("consumes a valid code once", async () => {
    vi.mocked(findLatestEmailOtp).mockResolvedValue({
      id: "otp-5",
      email: "a@b.com",
      codeHash: "hash:424242",
      purpose: "login",
      payload: { locale: "en" },
      attempts: 0,
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      createdAt: new Date(),
    });

    const result = await consumeEmailOtp({ email: "a@b.com", code: "424242" });
    expect(result.purpose).toBe("login");
    expect(markEmailOtpConsumed).toHaveBeenCalledWith("otp-5");
  });
});

describe("invite email templates and accept flow", () => {
  it("invite email contains a valid accept link", () => {
    const token = "test-invite-token-abcdefghijklmnopqrstuvwxyz";
    const acceptUrl = inviteAcceptUrl(token);
    expect(acceptUrl).toMatch(/\/invite\/test-invite-token/);

    const rendered = renderInviteEmail({
      garageName: "Shree Motors",
      role: "TECHNICIAN",
      acceptUrl,
      expiresAt: new Date("2030-01-15T00:00:00Z"),
      locale: "en",
    });
    expect(rendered.html).toContain(acceptUrl);
    expect(rendered.text).toContain(acceptUrl);
    expect(rendered.subject).toContain("Shree Motors");
  });

  it("renders OTP templates in hi and gu without inline English-only subjects", () => {
    expect(renderOtpEmail({ code: "123456", locale: "hi" }).subject).toContain(
      "साइन-इन",
    );
    expect(renderOtpEmail({ code: "123456", locale: "gu" }).subject).toContain(
      "સાઇન-ઇન",
    );
  });

  it("rejects revoked or expired invites by token", async () => {
    vi.mocked(findPendingInviteByTokenHash).mockResolvedValue(null);
    const { requestInviteOtp } = await import("@/modules/auth/service");
    await expect(
      requestInviteOtp({
        token: "revoked-or-expired-token-value",
        name: "Alex",
      }),
    ).rejects.toMatchObject({ code: "auth.invalid_invite" });
  });
});

describe("fake email provider contract", () => {
  it("records sends for assertions", async () => {
    const { provider, sent } = makeFakeProvider();
    await provider.sendEmail({
      to: "a@b.com",
      subject: "Hi",
      html: "<p>x</p>",
      text: "x",
    });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe("a@b.com");
  });
});

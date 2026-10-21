import { z } from "zod";

export const requestSignupOtpSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(160),
  garageName: z.string().trim().min(2).max(120),
});

export const requestLoginOtpSchema = z.object({
  email: z.string().trim().email().max(160),
});

export const verifyOtpSchema = z.object({
  email: z.string().trim().email().max(160),
  code: z.string().trim().min(4).max(12),
});

export const requestInviteOtpSchema = z.object({
  token: z.string().trim().min(16).max(200),
  name: z.string().trim().min(2).max(80),
});

export type RequestSignupOtpInput = z.infer<typeof requestSignupOtpSchema>;
export type RequestLoginOtpInput = z.infer<typeof requestLoginOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type RequestInviteOtpInput = z.infer<typeof requestInviteOtpSchema>;

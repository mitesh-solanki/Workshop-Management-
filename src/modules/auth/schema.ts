import { z } from "zod";

export const requestSignupOtpSchema = z.object({
  name: z.string().trim().min(2, { error: "validation.tooShort" }).max(80, {
    error: "validation.tooLong",
  }),
  email: z
    .string()
    .trim()
    .email({ error: "validation.invalidEmail" })
    .max(160, { error: "validation.tooLong" }),
  garageName: z
    .string()
    .trim()
    .min(2, { error: "validation.tooShort" })
    .max(120, { error: "validation.tooLong" }),
});

export const requestLoginOtpSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ error: "validation.invalidEmail" })
    .max(160, { error: "validation.tooLong" }),
});

export const verifyOtpSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ error: "validation.invalidEmail" })
    .max(160, { error: "validation.tooLong" }),
  code: z
    .string()
    .trim()
    .min(4, { error: "validation.tooShort" })
    .max(12, { error: "validation.tooLong" }),
});

export const requestInviteOtpSchema = z.object({
  token: z
    .string()
    .trim()
    .min(16, { error: "validation.tooShort" })
    .max(200, { error: "validation.tooLong" }),
  name: z
    .string()
    .trim()
    .min(2, { error: "validation.tooShort" })
    .max(80, { error: "validation.tooLong" }),
});

export const prodPasswordLoginSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ error: "validation.invalidEmail" })
    .max(160, { error: "validation.tooLong" }),
  password: z
    .string()
    .min(1, { error: "validation.required" })
    .max(128, { error: "validation.tooLong" }),
});

export type RequestSignupOtpInput = z.infer<typeof requestSignupOtpSchema>;
export type RequestLoginOtpInput = z.infer<typeof requestLoginOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type RequestInviteOtpInput = z.infer<typeof requestInviteOtpSchema>;
export type ProdPasswordLoginInput = z.infer<typeof prodPasswordLoginSchema>;

import { z } from "zod";
import { passwordPolicyErrorKey } from "@/lib/password";

const emailField = z
  .string()
  .trim()
  .email({ error: "validation.invalidEmail" })
  .max(160, { error: "validation.tooLong" });

const passwordField = z
  .string()
  .min(1, { error: "validation.required" })
  .max(128, { error: "validation.tooLong" })
  .superRefine((value, ctx) => {
    const key = passwordPolicyErrorKey(value);
    if (key) {
      ctx.addIssue({ code: "custom", message: key });
    }
  });

export const requestSignupOtpSchema = z.object({
  name: z.string().trim().min(2, { error: "validation.tooShort" }).max(80, {
    error: "validation.tooLong",
  }),
  email: emailField,
  garageName: z
    .string()
    .trim()
    .min(2, { error: "validation.tooShort" })
    .max(120, { error: "validation.tooLong" }),
});

export const signupWithPasswordSchema = z
  .object({
    name: z.string().trim().min(2, { error: "validation.tooShort" }).max(80, {
      error: "validation.tooLong",
    }),
    email: emailField,
    garageName: z
      .string()
      .trim()
      .min(2, { error: "validation.tooShort" })
      .max(120, { error: "validation.tooLong" }),
    password: passwordField,
    confirmPassword: z.string().min(1, { error: "validation.required" }),
  })
  .superRefine((value, ctx) => {
    if (value.password !== value.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        message: "validation.passwordMismatch",
        path: ["confirmPassword"],
      });
    }
  });

export const requestLoginOtpSchema = z.object({
  email: emailField,
});

export const verifyOtpSchema = z.object({
  email: emailField,
  code: z
    .string()
    .trim()
    .min(4, { error: "validation.tooShort" })
    .max(12, { error: "validation.tooLong" }),
});

export const acceptInviteWithPasswordSchema = z
  .object({
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
    password: passwordField,
    confirmPassword: z.string().min(1, { error: "validation.required" }),
  })
  .superRefine((value, ctx) => {
    if (value.password !== value.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        message: "validation.passwordMismatch",
        path: ["confirmPassword"],
      });
    }
  });

/** @deprecated OTP invite — kept for older tests; prefer acceptInviteWithPasswordSchema. */
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

export const passwordLoginSchema = z.object({
  email: emailField,
  password: z
    .string()
    .min(1, { error: "validation.required" })
    .max(128, { error: "validation.tooLong" }),
});

/** @deprecated Use passwordLoginSchema */
export const prodPasswordLoginSchema = passwordLoginSchema;

export const forgotPasswordSchema = z.object({
  email: emailField,
});

export const resetPasswordSchema = z
  .object({
    token: z
      .string()
      .trim()
      .min(16, { error: "validation.tooShort" })
      .max(200, { error: "validation.tooLong" }),
    password: passwordField,
    confirmPassword: z.string().min(1, { error: "validation.required" }),
  })
  .superRefine((value, ctx) => {
    if (value.password !== value.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        message: "validation.passwordMismatch",
        path: ["confirmPassword"],
      });
    }
  });

export const changeOwnPasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, { error: "validation.required" })
      .max(128, { error: "validation.tooLong" }),
    password: passwordField,
    confirmPassword: z.string().min(1, { error: "validation.required" }),
  })
  .superRefine((value, ctx) => {
    if (value.password !== value.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        message: "validation.passwordMismatch",
        path: ["confirmPassword"],
      });
    }
  });

export const changeOwnNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: "validation.tooShort" })
    .max(80, { error: "validation.tooLong" }),
});

export type RequestSignupOtpInput = z.infer<typeof requestSignupOtpSchema>;
export type SignupWithPasswordInput = z.infer<typeof signupWithPasswordSchema>;
export type RequestLoginOtpInput = z.infer<typeof requestLoginOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type RequestInviteOtpInput = z.infer<typeof requestInviteOtpSchema>;
export type AcceptInviteWithPasswordInput = z.infer<
  typeof acceptInviteWithPasswordSchema
>;
export type PasswordLoginInput = z.infer<typeof passwordLoginSchema>;
export type ProdPasswordLoginInput = PasswordLoginInput;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangeOwnPasswordInput = z.infer<typeof changeOwnPasswordSchema>;
export type ChangeOwnNameInput = z.infer<typeof changeOwnNameSchema>;

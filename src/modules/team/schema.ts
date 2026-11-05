import { z } from "zod";
import { isValidEmail } from "@/lib/contact";
import { passwordPolicyErrorKey } from "@/lib/password";

export const inviteRoleSchema = z.enum(["MANAGER", "TECHNICIAN", "ACCOUNTANT"]);

const memberIdField = z
  .string()
  .trim()
  .min(1, { error: "validation.required" })
  .max(64, { error: "validation.tooLong" });

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

export const createInviteSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { error: "validation.required" })
    .max(160, { error: "validation.tooLong" })
    .refine((value) => isValidEmail(value), {
      error: "validation.invalidEmail",
    }),
  role: inviteRoleSchema,
});

export const inviteIdSchema = z.object({
  inviteId: z.string().trim().min(1, { error: "validation.required" }).max(64, {
    error: "validation.tooLong",
  }),
});

export const changeMemberRoleSchema = z.object({
  userId: z.string().trim().min(1, { error: "validation.required" }).max(64, {
    error: "validation.tooLong",
  }),
  role: inviteRoleSchema,
});

export const updateMemberSchema = z.object({
  userId: z.string().trim().min(1, { error: "validation.required" }).max(64, {
    error: "validation.tooLong",
  }),
  name: z
    .string()
    .trim()
    .min(1, { error: "validation.required" })
    .max(120, { error: "validation.tooLong" }),
  email: z
    .string()
    .trim()
    .min(1, { error: "validation.required" })
    .max(160, { error: "validation.tooLong" })
    .refine((value) => isValidEmail(value), {
      error: "validation.invalidEmail",
    }),
  role: inviteRoleSchema,
});

export const removeMemberSchema = z.object({
  userId: memberIdField,
});

export const setMemberActiveSchema = z.object({
  userId: memberIdField,
  isActive: z.boolean(),
});

export const setMemberPasswordSchema = z
  .object({
    userId: memberIdField,
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

export const sendMemberPasswordResetSchema = z.object({
  userId: memberIdField,
});

export type CreateInviteInput = z.infer<typeof createInviteSchema>;
export type InviteIdInput = z.infer<typeof inviteIdSchema>;
export type ChangeMemberRoleInput = z.infer<typeof changeMemberRoleSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
export type RemoveMemberInput = z.infer<typeof removeMemberSchema>;
export type SetMemberActiveInput = z.infer<typeof setMemberActiveSchema>;
export type SetMemberPasswordInput = z.infer<typeof setMemberPasswordSchema>;
export type SendMemberPasswordResetInput = z.infer<
  typeof sendMemberPasswordResetSchema
>;

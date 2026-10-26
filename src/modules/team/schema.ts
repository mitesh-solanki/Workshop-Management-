import { z } from "zod";
import { isValidEmail } from "@/lib/contact";

export const inviteRoleSchema = z.enum(["MANAGER", "TECHNICIAN", "ACCOUNTANT"]);

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

export const removeMemberSchema = z.object({
  userId: z.string().trim().min(1, { error: "validation.required" }).max(64, {
    error: "validation.tooLong",
  }),
});

export type CreateInviteInput = z.infer<typeof createInviteSchema>;
export type InviteIdInput = z.infer<typeof inviteIdSchema>;
export type ChangeMemberRoleInput = z.infer<typeof changeMemberRoleSchema>;
export type RemoveMemberInput = z.infer<typeof removeMemberSchema>;

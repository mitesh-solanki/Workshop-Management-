import { z } from "zod";

export const inviteRoleSchema = z.enum(["MANAGER", "TECHNICIAN", "ACCOUNTANT"]);

export const createInviteSchema = z.object({
  email: z.string().trim().email().max(160),
  role: inviteRoleSchema,
});

export type CreateInviteInput = z.infer<typeof createInviteSchema>;

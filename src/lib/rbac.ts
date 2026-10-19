import type { Role } from "@prisma/client";
import { ForbiddenError } from "@/lib/errors";

export type RoleSession = {
  userId: string;
  garageId: string;
  role: Role;
};

export function requireRole<T extends RoleSession>(
  session: T,
  allowed: readonly Role[],
): T {
  if (!allowed.includes(session.role)) {
    throw new ForbiddenError();
  }
  return session;
}

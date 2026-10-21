import "server-only";

import type { Role } from "@prisma/client";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { UnauthorizedError } from "@/lib/errors";

export type SessionContext = {
  userId: string;
  garageId: string;
  role: Role;
  email: string;
  name: string | null;
};

export { requireRole } from "@/lib/rbac";

async function readAuthSession() {
  // Auth.js JWT verification uses crypto; opt into request-time rendering
  // so Cache Components does not try to prerender an unstable value.
  await connection();
  return auth();
}

export async function requireSession(): Promise<SessionContext> {
  const session = await readAuthSession();
  const user = session?.user;

  if (!user?.id || !user.garageId || !user.role || !user.email) {
    redirect("/login");
  }

  return {
    userId: user.id,
    garageId: user.garageId,
    role: user.role,
    email: user.email,
    name: user.name ?? null,
  };
}

export async function getOptionalSession(): Promise<SessionContext | null> {
  const session = await readAuthSession();
  const user = session?.user;

  if (!user?.id || !user.garageId || !user.role || !user.email) {
    return null;
  }

  return {
    userId: user.id,
    garageId: user.garageId,
    role: user.role,
    email: user.email,
    name: user.name ?? null,
  };
}

export function assertSession(session: SessionContext | null): SessionContext {
  if (!session) {
    throw new UnauthorizedError();
  }
  return session;
}

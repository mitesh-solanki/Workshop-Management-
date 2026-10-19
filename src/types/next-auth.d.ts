import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      garageId: string;
      role: Role;
    } & DefaultSession["user"];
  }

  interface User {
    garageId: string;
    role: Role;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    garageId?: string;
    role?: Role;
  }
}

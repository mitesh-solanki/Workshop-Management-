import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { Role } from "@prisma/client";
import { z } from "zod";
import {
  completeOtpSignIn,
  completeProdPasswordSignIn,
  getAuthAdapter,
  getUserForSessionRefresh,
} from "@/modules/auth/service";

const credentialsSchema = z.object({
  email: z.string().email(),
  code: z.string().min(4).max(12),
});

const prodPasswordSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
  ip: z.string().optional(),
});

/** How long a normal signed-in session lasts (sliding refresh within this window). */
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: getAuthAdapter(),
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      id: "email-otp",
      name: "Email OTP",
      credentials: {
        email: { label: "Email", type: "email" },
        code: { label: "Code", type: "text" },
      },
      authorize: async (raw) => {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) {
          return null;
        }

        try {
          const user = await completeOtpSignIn(parsed.data);
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            garageId: user.garageId,
            role: user.role,
          };
        } catch {
          return null;
        }
      },
    }),
    Credentials({
      id: "prod-password",
      name: "Production password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (raw) => {
        const parsed = prodPasswordSchema.safeParse(raw);
        if (!parsed.success) {
          return null;
        }

        try {
          const user = await completeProdPasswordSignIn(
            {
              email: parsed.data.email,
              password: parsed.data.password,
            },
            { ip: parsed.data.ip },
          );
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            garageId: user.garageId,
            role: user.role,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id && user.garageId && user.role) {
        token.userId = user.id;
        token.garageId = user.garageId;
        token.role = user.role;
        token.email = user.email;
        token.name = user.name;
        return token;
      }

      const userId = typeof token.userId === "string" ? token.userId : null;
      if (!userId) {
        return token;
      }

      const dbUser = await getUserForSessionRefresh(userId);
      if (!dbUser) {
        // User was removed (or no longer exists) — invalidate the JWT claims.
        delete token.userId;
        delete token.garageId;
        delete token.role;
        delete token.email;
        delete token.name;
        return token;
      }

      token.userId = dbUser.id;
      token.garageId = dbUser.garageId;
      token.role = dbUser.role;
      token.email = dbUser.email;
      token.name = dbUser.name;
      return token;
    },
    async session({ session, token }) {
      const userId = typeof token.userId === "string" ? token.userId : null;
      const garageId =
        typeof token.garageId === "string" ? token.garageId : null;
      const role = token.role;

      // Missing claims (including after a removed member) → requireSession sends them to login.
      if (session.user && userId && garageId && role) {
        session.user.id = userId;
        session.user.garageId = garageId;
        session.user.role = role as Role;
        if (typeof token.email === "string") {
          session.user.email = token.email;
        }
        if (typeof token.name === "string" || token.name === null) {
          session.user.name = token.name;
        }
      }
      return session;
    },
  },
});

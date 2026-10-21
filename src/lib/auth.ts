import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { completeOtpSignIn } from "@/modules/auth/service";

const credentialsSchema = z.object({
  email: z.string().email(),
  code: z.string().min(4).max(12),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
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

      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          garageId: true,
          role: true,
        },
      });
      if (dbUser) {
        token.userId = dbUser.id;
        token.garageId = dbUser.garageId;
        token.role = dbUser.role;
        token.email = dbUser.email;
        token.name = dbUser.name;
      }
      return token;
    },
    async session({ session, token }) {
      const userId = typeof token.userId === "string" ? token.userId : null;
      const garageId =
        typeof token.garageId === "string" ? token.garageId : null;
      const role = token.role;

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

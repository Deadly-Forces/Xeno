import { verify } from "argon2";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { z } from "zod";
import { env } from "./env";
import { db } from "./db";

export const authOptions: NextAuthOptions = {
  secret: env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [CredentialsProvider({
    name: "Marketer account",
    credentials: { organization: { label: "Workspace", type: "text" }, email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" } },
    async authorize(credentials) {
      const parsed = z.object({ organization: z.string().trim().min(1), email: z.string().email(), password: z.string().min(8) }).safeParse(credentials);
      if (!parsed.success) return null;
      const user = await db.appUser.findFirst({ where: { email: parsed.data.email.toLowerCase(), organization: { slug: parsed.data.organization.toLowerCase() } } });
      if (!user) return null;
      const valid = user.passwordHash.startsWith("$argon2") && await verify(user.passwordHash, parsed.data.password);
      if (!valid) return null;
      return { id: user.id, email: user.email, name: user.name, role: user.role, organizationId: user.organizationId };
    }
  })],
  callbacks: {
    jwt({ token, user }) { if (user) { token.id = user.id; token.role = user.role; token.organizationId = user.organizationId; } return token; },
    session({ session, token }) { if (session.user) { session.user.id = token.id ?? "unknown"; session.user.role = token.role ?? "ANALYST"; session.user.organizationId = token.organizationId ?? "org_xeno_default"; } return session; }
  }
};

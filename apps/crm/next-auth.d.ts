import type { DefaultSession } from "next-auth";
import type { UserRole } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & { id: string; role: UserRole; organizationId: string };
  }
  interface User { role: UserRole; organizationId: string }
}

declare module "next-auth/jwt" {
  interface JWT { id?: string; role?: UserRole; organizationId?: string }
}

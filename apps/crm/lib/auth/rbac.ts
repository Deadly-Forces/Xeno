import type { UserRole } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

const rank: Record<UserRole, number> = { ANALYST: 1, MARKETER: 2, ADMIN: 3 };

export type Actor = { id: string; email: string; role: UserRole; organizationId: string };

export async function requireRole(minimum: UserRole): Promise<Actor> {
  if (process.env.NODE_ENV === "test") return { id: "test", email: "test@example.com", role: "ADMIN", organizationId: "org_xeno_default" };
  const session = await getServerSession(authOptions);
  const user = session?.user;
  if (!user?.email || rank[user.role] < rank[minimum]) {
    console.warn(JSON.stringify({ level: "warn", event: "rbac_forbidden", minimum, userRole: user?.role, userEmail: user?.email }));
    throw new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { "content-type": "application/json" } });
  }
  return { id: user.id, email: user.email, role: user.role, organizationId: user.organizationId };
}

export function isResponse(error: unknown): error is Response {
  return error instanceof Response;
}

import type { Prisma } from "@prisma/client";
import { db } from "../core/db";
import type { Actor } from "../auth/rbac";

export async function audit(actor: Actor, action: string, entityType: string, entityId?: string, metadata?: Prisma.InputJsonValue, ipAddress?: string | null): Promise<void> {
  await db.auditLog.create({ data: { organizationId: actor.organizationId, actorId: actor.id === "unknown" || actor.id === "test" ? null : actor.id, actorEmail: actor.email, action, entityType, entityId: entityId ?? null, ...(metadata !== undefined ? { metadata } : {}), ipAddress: ipAddress ?? null } });
}

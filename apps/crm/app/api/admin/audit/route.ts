import { db } from "../../../../lib/db";
import { isResponse, requireRole } from "../../../../lib/rbac";

export async function GET(request: Request): Promise<Response> {
  try {
    const limit = Math.min(200, Math.max(1, Number(new URL(request.url).searchParams.get("limit") ?? 50)));
    const actor = await requireRole("ADMIN");
    const entries = await db.auditLog.findMany({ where: { organizationId: actor.organizationId }, orderBy: { createdAt: "desc" }, take: limit, select: { id: true, actorEmail: true, action: true, entityType: true, entityId: true, metadata: true, ipAddress: true, createdAt: true } });
    return Response.json(entries);
  } catch (error) { return isResponse(error) ? error : Response.json({ error: "Unable to load audit log" }, { status: 500 }); }
}

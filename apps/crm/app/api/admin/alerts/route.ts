import { z } from "zod";
import { db } from "../../../../lib/db";
import { audit } from "../../../../lib/audit";
import { isResponse, requireRole } from "../../../../lib/rbac";

export async function GET(): Promise<Response> {
  try { const actor = await requireRole("ADMIN"); return Response.json(await db.operationalAlert.findMany({ where: { organizationId: actor.organizationId }, orderBy: { createdAt: "desc" }, take: 100 })); }
  catch (error) { return isResponse(error) ? error : Response.json({ error: "Unable to load alerts" }, { status: 500 }); }
}
export async function POST(request: Request): Promise<Response> {
  try { const actor = await requireRole("ADMIN"); const input = z.object({ id: z.string().cuid(), status: z.enum(["ACKNOWLEDGED", "RESOLVED"]) }).parse(await request.json()); const updated = await db.operationalAlert.updateMany({ where: { id: input.id, organizationId: actor.organizationId }, data: { status: input.status, resolvedAt: input.status === "RESOLVED" ? new Date() : null } }); if (!updated.count) return Response.json({ error: "Alert not found" }, { status: 404 }); await audit(actor, "alert.update", "OperationalAlert", input.id, { status: input.status }); return Response.json({ updated: true }); }
  catch (error) { return isResponse(error) ? error : Response.json({ error: "Unable to update alert" }, { status: 400 }); }
}

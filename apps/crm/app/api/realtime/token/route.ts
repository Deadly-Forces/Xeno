import { z } from "zod";
import { db } from "../../../../lib/db";
import { createRealtimeToken } from "../../../../lib/realtime-token";
import { isResponse, requireRole } from "../../../../lib/rbac";

export async function POST(request: Request): Promise<Response> {
  try { const actor = await requireRole("ANALYST"); const { campaignId } = z.object({ campaignId: z.string().cuid() }).parse(await request.json()); const exists = await db.campaign.count({ where: { id: campaignId, organizationId: actor.organizationId } }); if (!exists) return Response.json({ error: "Campaign not found" }, { status: 404 }); return Response.json({ token: createRealtimeToken({ organizationId: actor.organizationId, userId: actor.id, campaignId, expiresAt: Date.now() + 60_000 }) }); }
  catch (error) { return isResponse(error) ? error : Response.json({ error: "Unable to issue token" }, { status: 400 }); }
}

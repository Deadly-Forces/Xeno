import { z } from "zod";
import { audit } from "../../../../../lib/audit";
import { db } from "../../../../../lib/db";
import { apiError } from "../../../../../lib/http";
import { campaignJobOptions, campaignQueue, redis } from "../../../../../lib/queue";
import { isResponse, requireRole } from "../../../../../lib/rbac";

const schema = z.object({ action: z.enum(["pause", "resume"]) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const actor = await requireRole("MARKETER");
    const { id } = await context.params;
    const { action } = schema.parse(await request.json());
    const campaign = await db.campaign.findFirst({ where: { id, organizationId: actor.organizationId }, select: { id: true } });
    if (!campaign) return Response.json({ error: "Campaign not found" }, { status: 404 });
    await db.campaign.update({ where: { id }, data: { guardrailPaused: action === "pause", guardrailReason: action === "pause" ? "Paused by operator" : null } });
    if (action === "resume") {
      const queued = await db.campaignMessage.findMany({ where: { campaignId: id, status: "QUEUED", isHoldout: false }, select: { id: true } });
      await campaignQueue.addBulk(queued.map((message) => ({ name: "deliver", data: { kind: "deliver" as const, campaignMessageId: message.id }, opts: { ...campaignJobOptions, jobId: `${message.id}-resume-${Date.now()}` } })));
    }
    await redis.del(`campaign:${id}:stats`);
    await audit(actor, `campaign.guardrail.${action}`, "Campaign", id, {});
    return Response.json({ ok: true, action });
  } catch (error) { return isResponse(error) ? error : apiError(error); }
}

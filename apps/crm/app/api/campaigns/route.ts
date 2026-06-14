import { channelSchema } from "@xeno/shared-types";
import { z } from "zod";
import { db } from "../../../lib/db";
import { apiError } from "../../../lib/http";
import { requireRole, isResponse } from "../../../lib/rbac";
import { audit } from "../../../lib/audit";

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  segmentId: z.string().cuid(),
  channel: channelSchema,
  messageTemplate: z.string().trim().min(1).max(10_000),
  scheduledAt: z.string().datetime().nullable().optional(),
  aiGenerated: z.boolean().default(false),
  experiment: z.object({ hypothesis: z.string().trim().min(5).max(300), treatmentTemplate: z.string().trim().min(1).max(10_000), controlAllocation: z.number().int().min(10).max(90).default(50) }).optional()
  ,targetingMode: z.enum(["ALL", "SCORE_TOP_PERCENT"]).default("ALL")
  ,targetPercentage: z.number().int().min(1).max(100).default(100)
  ,useRecommendedChannel: z.boolean().default(false)
  ,useRecommendedSendTime: z.boolean().default(false)
  ,holdoutPercentage: z.number().int().min(0).max(25).default(0)
  ,maxBudget: z.number().positive().nullable().optional()
  ,failureRateThreshold: z.number().min(0.01).max(1).default(0.15)
  ,minimumConversionRate: z.number().min(0).max(1).default(0)
  ,chaosEnabled: z.boolean().default(false)
  ,chaosFailureRate: z.number().min(0).max(1).default(0)
  ,chaosLatencyMs: z.number().int().min(0).max(30_000).default(0)
  ,chaosDuplicateCallbacks: z.boolean().default(false)
  ,chaosOutOfOrderCallbacks: z.boolean().default(false)
});

export async function GET(): Promise<Response> {
  try { const actor = await requireRole("ANALYST"); return Response.json(await db.campaign.findMany({ where: { organizationId: actor.organizationId }, orderBy: { createdAt: "desc" }, select: { id: true, name: true, status: true, channel: true, createdAt: true, segment: { select: { name: true, customerCount: true } } } })); }
  catch (error) { return isResponse(error) ? error : Response.json({ error: "Forbidden" }, { status: 403 }); }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const actor = await requireRole("MARKETER");
    const input = schema.parse(await request.json());
    const { experiment, maxBudget, ...campaignInput } = input;
    const campaign = await db.campaign.create({ data: {
      ...campaignInput, organizationId: actor.organizationId,
      scheduledAt: campaignInput.scheduledAt ? new Date(campaignInput.scheduledAt) : null,
      ...(maxBudget !== undefined ? { maxBudget } : {}),
      ...(experiment ? { experiment: { create: { hypothesis: experiment.hypothesis, controlAllocation: experiment.controlAllocation, variants: { create: [
        { name: "Control", kind: "CONTROL", messageTemplate: input.messageTemplate },
        { name: "AI treatment", kind: "TREATMENT", messageTemplate: experiment.treatmentTemplate }
      ] } } } } : {})
    }, select: { id: true, status: true } });
    await audit(actor, "campaign.create", "Campaign", campaign.id, { experimentEnabled: Boolean(experiment), channel: input.channel });
    return Response.json(campaign, { status: 201 });
  } catch (error) { return isResponse(error) ? error : apiError(error); }
}

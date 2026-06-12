import { db } from "../db";
import { campaignJobOptions, campaignQueue, redis } from "../queue";
import { executeSegmentDSL } from "../segments/execute";
import { scoreCustomer, stableBucket } from "../decisioning/model";
import { activeModel, extractFeatures, predictArtifact } from "../ml/pipeline";

export class CampaignLaunchError extends Error {
  override readonly name = "CampaignLaunchError";
  constructor(message: string, readonly status: number) { super(message); }
}

function nextHour(hour: number, base: Date): Date {
  const scheduled = new Date(base);
  scheduled.setHours(hour, 0, 0, 0);
  if (scheduled.getTime() <= base.getTime()) scheduled.setDate(scheduled.getDate() + 1);
  return scheduled;
}

export async function launchCampaign(campaignId: string, organizationId = "org_xeno_default"): Promise<{ campaignId: string; enqueued: number; excluded: number }> {
  const acquired = await redis.set(`campaign:${campaignId}:launch-lock`, "1", "EX", 10, "NX");
  if (!acquired) throw new CampaignLaunchError("Campaign launch is already being processed", 429);
  const campaign = await db.campaign.findFirst({ where: { id: campaignId, organizationId }, select: { id: true, organizationId: true, status: true, channel: true, messageTemplate: true, scheduledAt: true, targetingMode: true, targetPercentage: true, useRecommendedChannel: true, useRecommendedSendTime: true, segment: { select: { filterRules: true } }, experiment: { select: { id: true, controlAllocation: true, variants: { select: { id: true, kind: true, messageTemplate: true } } } } } });
  if (!campaign) throw new CampaignLaunchError("Campaign not found", 404);
  if (campaign.status !== "DRAFT") throw new CampaignLaunchError(`Campaign is already ${campaign.status}`, 409);
  const claimed = await db.campaign.updateMany({ where: { id: campaign.id, status: "DRAFT" }, data: { status: "RUNNING" } });
  if (claimed.count !== 1) throw new CampaignLaunchError("Campaign launch already claimed", 409);
  try {
    const weekAgo = new Date(Date.now() - 7 * 86_400_000);
    const candidates = await db.customer.findMany({ where: { AND: [executeSegmentDSL(campaign.segment.filterRules), { organizationId, consentStatus: "OPTED_IN", suppressedAt: null }] }, select: { id: true, name: true, totalOrderValue: true, totalOrders: true, lastOrderAt: true, channelPreference: true, maxMessagesPerWeek: true, campaignMessages: { where: { sentAt: { gte: weekAgo } }, select: { id: true } }, orders: { take: 1, orderBy: { createdAt: "desc" }, select: { items: true } } } });
    const model = await activeModel(organizationId);
    const scored = candidates.map((customer) => {
      const fallback = scoreCustomer(customer);
      const probability = model ? predictArtifact(model, extractFeatures(customer)) : fallback.conversionProbability;
      const averageOrderValue = customer.totalOrders ? Number(customer.totalOrderValue) / customer.totalOrders : Number(customer.totalOrderValue);
      return { customer, decision: { ...fallback, conversionProbability: probability, decisionScore: probability * 100, expectedRevenue: probability * Math.max(10, averageOrderValue) } };
    }).filter(({ customer }) => customer.campaignMessages.length < customer.maxMessagesPerWeek).sort((left, right) => right.decision.decisionScore - left.decision.decisionScore);
    const customers = campaign.targetingMode === "SCORE_TOP_PERCENT" ? scored.slice(0, Math.max(1, Math.ceil(scored.length * campaign.targetPercentage / 100))) : scored;
    const messages = await db.$transaction(customers.map((customer) => {
      const decision = customer.decision;
      const profile = customer.customer;
      const kind = stableBucket(`${campaign.id}:${profile.id}`) < (campaign.experiment?.controlAllocation ?? 100) ? "CONTROL" : "TREATMENT";
      const variant = campaign.experiment?.variants.find((item) => item.kind === kind);
      const template = variant?.messageTemplate ?? campaign.messageTemplate;
      const latestItems = profile.orders[0]?.items;
      const latestProduct = Array.isArray(latestItems) && typeof latestItems[0] === "object" && latestItems[0] !== null && "product" in latestItems[0] ? String(latestItems[0].product) : "your last purchase";
      const actualChannel = campaign.useRecommendedChannel ? decision.recommendedChannel : campaign.channel;
      const scheduledFor = campaign.useRecommendedSendTime ? nextHour(decision.recommendedSendHour, campaign.scheduledAt ?? new Date()) : campaign.scheduledAt;
      return db.campaignMessage.upsert({ where: { campaignId_customerId: { campaignId: campaign.id, customerId: profile.id } }, update: {}, create: {
        campaignId: campaign.id,
        customerId: profile.id,
        variantId: variant?.id ?? null,
        personalizedMessage: template.replaceAll("{{name}}", profile.name).replaceAll("{{lastProduct}}", latestProduct),
        decisionScore: decision.decisionScore,
        expectedRevenue: decision.expectedRevenue,
        churnRisk: decision.churnRisk,
        recommendedSendHour: decision.recommendedSendHour,
        actualChannel,
        scheduledFor,
        recommendationReasons: decision.reasons
      }, select: { id: true, scheduledFor: true } });
    }));
    if (campaign.experiment) await db.campaignExperiment.update({ where: { id: campaign.experiment.id }, data: { status: "RUNNING", startedAt: new Date() } });
    const delay = Math.max(0, (campaign.scheduledAt?.getTime() ?? Date.now()) - Date.now());
    await campaignQueue.addBulk(messages.map((message) => ({ name: "deliver", data: { kind: "deliver" as const, campaignMessageId: message.id }, opts: { ...campaignJobOptions, delay: Math.max(0, (message.scheduledFor?.getTime() ?? Date.now()) - Date.now()), jobId: message.id } })));
    await campaignQueue.add("finalize", { kind: "finalize", campaignId: campaign.id }, { ...campaignJobOptions, attempts: 1, delay: delay + 45_000, jobId: `finalize-${campaign.id}` });
    return { campaignId: campaign.id, enqueued: messages.length, excluded: candidates.length - messages.length };
  } catch (error) {
    await db.campaign.update({ where: { id: campaign.id }, data: { status: "FAILED", failureReason: error instanceof Error ? error.message : "Launch failed" }, select: { id: true } });
    throw error;
  }
}

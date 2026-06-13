import { db } from "../../../../../lib/db";
import { redis } from "../../../../../lib/queue";
import type { MessageStatus } from "@prisma/client";
import { experimentResult, type VariantMetric } from "../../../../../lib/experiments/stats";
import { isResponse, requireRole } from "../../../../../lib/rbac";

type StatsRow = { status: MessageStatus | null; messageCount: bigint; conversions: bigint; revenue: { toString(): string } | null };

export async function GET(_: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await context.params;
  let actor; try { actor = await requireRole("ANALYST"); } catch (error) { return isResponse(error) ? error : Response.json({ error: "Forbidden" }, { status: 403 }); }
  const cacheKey = `campaign:${id}:stats`;
  const cached = await redis.get(cacheKey);
  if (cached) return new Response(cached, { headers: { "content-type": "application/json", "x-cache": "hit" } });
  const campaign = await db.campaign.findFirst({ where: { id, organizationId: actor.organizationId }, select: { id: true, name: true, status: true, channel: true, messageTemplate: true, createdAt: true, failureReason: true, experiment: { select: { id: true, hypothesis: true, status: true, variants: { select: { id: true, name: true, kind: true } } } } } });
  if (!campaign) return Response.json({ error: "Campaign not found" }, { status: 404 });
  const rows = await db.$queryRaw<StatsRow[]>`
    SELECT cm.status,
           COUNT(DISTINCT cm.id)::bigint AS "messageCount",
           COUNT(DISTINCT ce.id)::bigint AS conversions,
           COALESCE(SUM(ce.revenue), 0) AS revenue
    FROM "CampaignMessage" cm
    LEFT JOIN "ConversionEvent" ce ON ce."campaignMessageId" = cm.id
    WHERE cm."campaignId" = ${campaign.id}
    GROUP BY cm.status
  `;
  const counts = Object.fromEntries(rows.filter((row) => row.status).map((row) => [row.status, Number(row.messageCount)]));
  let experiment = null;
  if (campaign.experiment) {
    const variantRows = await db.campaignVariant.findMany({ where: { experimentId: campaign.experiment.id }, select: { kind: true, name: true, messages: { select: { id: true, conversions: { select: { revenue: true } } } } } });
    const variants = variantRows.map((variant) => ({ kind: variant.kind, name: variant.name, recipients: variant.messages.length, conversions: variant.messages.filter((message) => message.conversions.length > 0).length, revenue: variant.messages.reduce((sum, message) => sum + message.conversions.reduce((inner, conversion) => inner + Number(conversion.revenue), 0), 0) }));
    const control = variants.find((item) => item.kind === "CONTROL");
    const treatment = variants.find((item) => item.kind === "TREATMENT");
    experiment = { hypothesis: campaign.experiment.hypothesis, status: campaign.experiment.status, variants, result: control && treatment ? experimentResult(control as VariantMetric, treatment as VariantMetric) : null };
  }
  const decisioning = await db.campaignMessage.aggregate({ where: { campaignId: campaign.id }, _avg: { decisionScore: true, expectedRevenue: true, churnRisk: true }, _sum: { expectedRevenue: true } });
  const costs = await db.deliveryCostEvent.aggregate({ where: { organizationId: actor.organizationId, campaignMessage: { campaignId: campaign.id } }, _sum: { totalCost: true } });
  const [receipts, audit] = await Promise.all([
    db.receiptEvent.findMany({ where: { campaignMessage: { campaignId: campaign.id } }, take: 12, orderBy: { timestamp: "desc" }, select: { id: true, event: true, timestamp: true } }),
    db.auditLog.findMany({ where: { organizationId: actor.organizationId, entityId: campaign.id }, take: 8, orderBy: { createdAt: "desc" }, select: { id: true, action: true, actorEmail: true, createdAt: true } })
  ]);
  const result = { campaign, counts, conversions: rows.reduce((sum, row) => sum + Number(row.conversions), 0), revenue: rows.reduce((sum, row) => sum + Number(row.revenue?.toString() ?? 0), 0), providerCost: Number(costs._sum.totalCost ?? 0), experiment, decisioning: { averageScore: decisioning._avg.decisionScore ?? 0, averageChurnRisk: decisioning._avg.churnRisk ?? 0, expectedRevenue: Number(decisioning._sum.expectedRevenue ?? 0) }, timeline: [...receipts.map((item) => ({ id: item.id, label: item.event.toLowerCase(), detail: "Delivery event", createdAt: item.timestamp })), ...audit.map((item) => ({ id: item.id, label: item.action, detail: item.actorEmail, createdAt: item.createdAt }))].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 12) };
  await redis.set(cacheKey, JSON.stringify(result), "EX", 5);
  return Response.json(result);
}

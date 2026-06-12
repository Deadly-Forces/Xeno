import { db } from "../../../lib/db";
import { isResponse, requireRole } from "../../../lib/rbac";

type ChannelRow = { channel: string; messages: bigint; delivered: bigint; opened: bigint; clicked: bigint };
type SegmentRow = { name: string; customers: number; messages: bigint; clicked: bigint };

export async function GET(): Promise<Response> {
  let actor; try { actor = await requireRole("ANALYST"); } catch (error) { return isResponse(error) ? error : Response.json({ error: "Forbidden" }, { status: 403 }); }
  const [channels, segments, campaignCount] = await Promise.all([
    db.$queryRaw<ChannelRow[]>`
      SELECT c.channel::text AS channel, COUNT(cm.id)::bigint AS messages,
        COUNT(cm.id) FILTER (WHERE cm.status IN ('DELIVERED','OPENED','READ','CLICKED'))::bigint AS delivered,
        COUNT(cm.id) FILTER (WHERE cm.status IN ('OPENED','READ','CLICKED'))::bigint AS opened,
        COUNT(cm.id) FILTER (WHERE cm.status = 'CLICKED')::bigint AS clicked
      FROM "Campaign" c LEFT JOIN "CampaignMessage" cm ON cm."campaignId" = c.id WHERE c."organizationId" = ${actor.organizationId} GROUP BY c.channel
    `,
    db.$queryRaw<SegmentRow[]>`
      SELECT s.name, s."customerCount" AS customers, COUNT(cm.id)::bigint AS messages,
        COUNT(cm.id) FILTER (WHERE cm.status = 'CLICKED')::bigint AS clicked
      FROM "Segment" s LEFT JOIN "Campaign" c ON c."segmentId" = s.id LEFT JOIN "CampaignMessage" cm ON cm."campaignId" = c.id
      WHERE s."organizationId" = ${actor.organizationId} GROUP BY s.id ORDER BY clicked DESC LIMIT 8
    `,
    db.campaign.count({ where: { organizationId: actor.organizationId } })
  ]);
  const tenantMessages = await db.campaignMessage.findMany({ where: { campaign: { organizationId: actor.organizationId } }, select: { id: true } });
  const attribution = await db.conversionEvent.groupBy({ by: ["campaignMessageId"], where: { campaignMessageId: { in: tenantMessages.map((item) => item.id) } }, _count: { _all: true }, _sum: { revenue: true } });
  const messageIds = attribution.map((item) => item.campaignMessageId);
  const messages = messageIds.length ? await db.campaignMessage.findMany({ where: { id: { in: messageIds }, campaign: { organizationId: actor.organizationId } }, select: { id: true, campaign: { select: { id: true, name: true, channel: true } } } }) : [];
  const cost = await db.deliveryCostEvent.aggregate({ where: { organizationId: actor.organizationId }, _sum: { totalCost: true } });
  const campaignMap = new Map(messages.map((message) => [message.id, message.campaign]));
  const attributed = new Map<string, { id: string; name: string; channel: string; conversions: number; revenue: number }>();
  for (const item of attribution) { const campaign = campaignMap.get(item.campaignMessageId); if (!campaign) continue; const current = attributed.get(campaign.id) ?? { ...campaign, conversions: 0, revenue: 0 }; current.conversions += item._count._all; current.revenue += Number(item._sum.revenue ?? 0); attributed.set(campaign.id, current); }
  return Response.json({
    channels: channels.map((row) => ({ channel: row.channel, messages: Number(row.messages), delivered: Number(row.delivered), opened: Number(row.opened), clicked: Number(row.clicked) })),
    segments: segments.map((row) => ({ name: row.name, customers: row.customers, messages: Number(row.messages), clicked: Number(row.clicked), clickRate: Number(row.messages) ? Math.round(Number(row.clicked) / Number(row.messages) * 1000) / 10 : 0 })),
    attribution: Array.from(attributed.values()).sort((a, b) => b.revenue - a.revenue),
    campaignCount,
    providerCost: Number(cost._sum.totalCost ?? 0)
  });
}

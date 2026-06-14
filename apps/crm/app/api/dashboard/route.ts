import type { Channel } from "@prisma/client";
import { db } from "../../../lib/core/db";
import { isResponse, requireRole } from "../../../lib/auth/rbac";

const channelValues = new Set<Channel>(["EMAIL", "SMS", "WHATSAPP", "RCS"]);
const dayKey = (date: Date): string => date.toISOString().slice(0, 10);
const percentChange = (current: number, previous: number): number => previous ? Math.round((current - previous) / previous * 1000) / 10 : current ? 100 : 0;

export async function GET(request: Request): Promise<Response> {
  let actor; try { actor = await requireRole("ANALYST"); } catch (error) { return isResponse(error) ? error : Response.json({ error: "Forbidden" }, { status: 403 }); }
  const url = new URL(request.url);
  const days = url.searchParams.get("range") === "7" ? 7 : 30;
  const requestedChannel = url.searchParams.get("channel")?.toUpperCase() as Channel | undefined;
  const channel = requestedChannel && channelValues.has(requestedChannel) ? requestedChannel : undefined;
  const end = new Date();
  const start = new Date(end.getTime() - days * 86_400_000);
  const previousStart = new Date(start.getTime() - days * 86_400_000);
  const campaignWhere = { organizationId: actor.organizationId, ...(channel ? { channel } : {}) };
  const [customers, campaigns, alerts, audit] = await Promise.all([
    db.customer.findMany({ where: { organizationId: actor.organizationId }, select: { id: true, createdAt: true } }),
    db.campaign.findMany({ where: { ...campaignWhere, createdAt: { gte: previousStart } }, orderBy: { createdAt: "desc" }, select: { id: true, name: true, channel: true, status: true, createdAt: true, failureReason: true, segment: { select: { name: true } }, messages: { select: { status: true, sentAt: true, deliveredAt: true, openedAt: true, clickedAt: true, conversions: { select: { revenue: true, createdAt: true } }, deliveryCosts: { select: { totalCost: true } } } } } }),
    db.operationalAlert.findMany({ where: { organizationId: actor.organizationId, status: "OPEN" }, take: 6, orderBy: { createdAt: "desc" }, select: { id: true, severity: true, title: true, source: true, createdAt: true } }),
    db.auditLog.findMany({ where: { organizationId: actor.organizationId, createdAt: { gte: start } }, take: 8, orderBy: { createdAt: "desc" }, select: { id: true, action: true, entityType: true, actorEmail: true, createdAt: true } })
  ]);
  const currentCampaigns = campaigns.filter((item) => item.createdAt >= start);
  const previousCampaigns = campaigns.filter((item) => item.createdAt < start);
  const summarize = (items: typeof campaigns) => {
    const messages = items.flatMap((item) => item.messages);
    const sent = messages.filter((item) => item.status !== "QUEUED" && item.status !== "FAILED").length;
    const opened = messages.filter((item) => ["OPENED", "READ", "CLICKED"].includes(item.status)).length;
    const clicked = messages.filter((item) => item.status === "CLICKED").length;
    const conversions = messages.reduce((sum, item) => sum + item.conversions.length, 0);
    const revenue = messages.reduce((sum, item) => sum + item.conversions.reduce((inner, conversion) => inner + Number(conversion.revenue), 0), 0);
    const cost = messages.reduce((sum, item) => sum + item.deliveryCosts.reduce((inner, entry) => inner + Number(entry.totalCost), 0), 0);
    return { campaigns: items.length, sent, opened, clicked, conversions, revenue, cost, openRate: sent ? opened / sent * 100 : 0 };
  };
  const current = summarize(currentCampaigns);
  const previous = summarize(previousCampaigns);
  const seriesMap = new Map<string, { date: string; sent: number; opened: number; clicked: number; conversions: number; revenue: number; cost: number }>();
  for (let offset = days - 1; offset >= 0; offset -= 1) { const date = new Date(end.getTime() - offset * 86_400_000); const key = dayKey(date); seriesMap.set(key, { date: key, sent: 0, opened: 0, clicked: 0, conversions: 0, revenue: 0, cost: 0 }); }
  for (const campaign of currentCampaigns) for (const message of campaign.messages) {
    const eventDate = message.sentAt ?? campaign.createdAt; const point = seriesMap.get(dayKey(eventDate)); if (!point) continue;
    if (message.status !== "QUEUED" && message.status !== "FAILED") point.sent += 1;
    if (["OPENED", "READ", "CLICKED"].includes(message.status)) point.opened += 1;
    if (message.status === "CLICKED") point.clicked += 1;
    point.cost += message.deliveryCosts.reduce((sum, entry) => sum + Number(entry.totalCost), 0);
    for (const conversion of message.conversions) { point.conversions += 1; point.revenue += Number(conversion.revenue); }
  }
  const ranked = currentCampaigns.map((campaign) => ({ campaign, summary: summarize([campaign]) })).sort((a, b) => b.summary.revenue - a.summary.revenue);
  const failed = currentCampaigns.filter((campaign) => campaign.status === "FAILED").map((campaign) => ({ id: `campaign-${campaign.id}`, severity: "critical", title: campaign.name, source: campaign.failureReason ?? "Campaign failed", createdAt: campaign.createdAt }));
  const funnel = { sent: current.sent, delivered: currentCampaigns.flatMap((item) => item.messages).filter((item) => ["DELIVERED", "OPENED", "READ", "CLICKED"].includes(item.status)).length, opened: current.opened, clicked: current.clicked, purchased: current.conversions };
  return Response.json({
    filters: { days, channel: channel ?? "ALL" },
    metrics: {
      customers: customers.length, active: currentCampaigns.filter((item) => item.status === "RUNNING").length, conversions: current.conversions, openRate: Math.round(current.openRate * 10) / 10, revenue: current.revenue, cost: current.cost,
      trends: { customers: percentChange(customers.filter((item) => item.createdAt >= start).length, customers.filter((item) => item.createdAt >= previousStart && item.createdAt < start).length), active: percentChange(current.campaigns, previous.campaigns), conversions: percentChange(current.conversions, previous.conversions), openRate: Math.round((current.openRate - previous.openRate) * 10) / 10 }
    },
    funnel,
    series: Array.from(seriesMap.values()),
    campaigns: currentCampaigns.slice(0, 6).map(({ messages: _messages, ...campaign }) => campaign),
    topCampaign: ranked[0] ? { id: ranked[0].campaign.id, name: ranked[0].campaign.name, revenue: ranked[0].summary.revenue, conversions: ranked[0].summary.conversions } : null,
    topSegment: ranked[0]?.campaign.segment.name ?? null,
    needsAttention: [...failed, ...alerts].slice(0, 6),
    activity: [...audit, ...currentCampaigns.slice(0, 4).map((campaign) => ({ id: `launch-${campaign.id}`, action: `${campaign.status.toLowerCase()} campaign`, entityType: campaign.name, actorEmail: "System", createdAt: campaign.createdAt }))].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 8)
  });
}

import { db } from "../../../lib/db";
import { isResponse, requireRole } from "../../../lib/rbac";

export async function GET(): Promise<Response> {
  let actor; try { actor = await requireRole("ANALYST"); } catch (error) { return isResponse(error) ? error : Response.json({ error: "Forbidden" }, { status: 403 }); }
  const [customers, active, conversions, campaigns, messageCounts] = await Promise.all([
    db.customer.count({ where: { organizationId: actor.organizationId } }),
    db.campaign.count({ where: { organizationId: actor.organizationId, status: "RUNNING" } }),
    db.conversionEvent.count({ where: { campaignMessage: { campaign: { organizationId: actor.organizationId } } } }),
    db.campaign.findMany({ where: { organizationId: actor.organizationId }, take: 5, orderBy: { createdAt: "desc" }, select: { id: true, name: true, channel: true, status: true, createdAt: true, segment: { select: { name: true } } } }),
    db.campaignMessage.groupBy({ by: ["status"], where: { campaign: { organizationId: actor.organizationId } }, _count: { _all: true } })
  ]);
  const sent = messageCounts.reduce((sum, item) => sum + item._count._all, 0);
  const opened = messageCounts.filter((item) => ["OPENED", "READ", "CLICKED"].includes(item.status)).reduce((sum, item) => sum + item._count._all, 0);
  return Response.json({ customers, active, conversions, openRate: sent ? Math.round(opened / sent * 100) : 0, campaigns });
}

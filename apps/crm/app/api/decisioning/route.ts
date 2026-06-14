import { db } from "../../../lib/core/db";
import { evaluateRanking, rankCustomers, DECISION_MODEL_VERSION } from "../../../lib/decisioning/model";
import { isResponse, requireRole } from "../../../lib/auth/rbac";
import { executeSegmentDSL } from "../../../lib/segments/execute";

export async function GET(request: Request): Promise<Response> {
  try {
    const actor = await requireRole("ANALYST");
    const segmentId = new URL(request.url).searchParams.get("segmentId");
    const segment = segmentId ? await db.segment.findFirst({ where: { id: segmentId, organizationId: actor.organizationId }, select: { filterRules: true } }) : null;
    const customers = await db.customer.findMany({
      where: { AND: [{ organizationId: actor.organizationId }, segment ? executeSegmentDSL(segment.filterRules) : {}] },
      select: { id: true, name: true, totalOrderValue: true, totalOrders: true, lastOrderAt: true, channelPreference: true, conversionEvents: { select: { revenue: true } } }
    });
    const ranked = rankCustomers(customers);
    const benchmark = evaluateRanking(customers);
    return Response.json({
      modelVersion: DECISION_MODEL_VERSION,
      generatedAt: new Date().toISOString(),
      audienceSize: customers.length,
      expectedRevenue: ranked.reduce((sum, item) => sum + item.expectedRevenue, 0),
      highChurnRisk: ranked.filter((item) => item.churnRisk >= 0.7).length,
      benchmark,
      recommendations: ranked.slice(0, 25)
    });
  } catch (error) { return isResponse(error) ? error : Response.json({ error: "Unable to evaluate audience" }, { status: 500 }); }
}

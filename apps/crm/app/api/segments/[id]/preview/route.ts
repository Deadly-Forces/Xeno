import { db } from "../../../../../lib/db";
import { executeSegmentDSL } from "../../../../../lib/segments/execute";
import { redis } from "../../../../../lib/queue";
import { isResponse, requireRole } from "../../../../../lib/rbac";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await context.params;
  let actor; try { actor = await requireRole("ANALYST"); } catch (error) { return isResponse(error) ? error : Response.json({ error: "Forbidden" }, { status: 403 }); }
  const segment = await db.segment.findFirst({ where: { id, organizationId: actor.organizationId }, select: { filterRules: true, customerCount: true } });
  if (!segment) return Response.json({ error: "Segment not found" }, { status: 404 });
  const where = { AND: [{ organizationId: actor.organizationId }, executeSegmentDSL(segment.filterRules)] };
  const countPromise = db.$transaction(async (transaction) => {
    await transaction.$executeRawUnsafe("SET LOCAL statement_timeout = '500ms'");
    return transaction.customer.count({ where });
  }, { timeout: 900 });
  const [countResult, customers] = await Promise.all([
    countPromise.then((count) => ({ count, cached: false })).catch(async () => ({ count: Number(await redis.get(`segment:${id}:count`) ?? segment.customerCount), cached: true })),
    db.customer.findMany({ where, take: 10, select: { id: true, name: true, email: true, phone: true, city: true, totalOrderValue: true, totalOrders: true, channelPreference: true } })
  ]);
  if (!countResult.cached) {
    await Promise.all([
      redis.set(`segment:${id}:count`, String(countResult.count), "EX", 300),
      db.segment.update({ where: { id }, data: { customerCount: countResult.count }, select: { id: true } })
    ]);
  }
  return Response.json({ count: countResult.count, countCached: countResult.cached, customers });
}

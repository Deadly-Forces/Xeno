import { segmentDslSchema } from "@xeno/shared-types";
import { db } from "../../../../lib/db";
import { apiError } from "../../../../lib/http";
import { executeSegmentDSL } from "../../../../lib/segments/execute";
import { redis } from "../../../../lib/queue";
import { createHash } from "node:crypto";
import { isResponse, requireRole } from "../../../../lib/rbac";

export async function POST(request: Request): Promise<Response> {
  try {
    const actor = await requireRole("ANALYST");
    const rules = segmentDslSchema.parse(await request.json());
    const where = { AND: [{ organizationId: actor.organizationId }, executeSegmentDSL(rules)] };
    const cacheKey = `segment-preview:${actor.organizationId}:${createHash("sha256").update(JSON.stringify(rules)).digest("hex")}`;
    const countPromise = db.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe("SET LOCAL statement_timeout = '500ms'");
      return transaction.customer.count({ where });
    }, { timeout: 900 });
    const [countResult, customers] = await Promise.all([
      countPromise.then((count) => ({ count, cached: false })).catch(async () => ({ count: Number(await redis.get(cacheKey) ?? 0), cached: true })),
      db.customer.findMany({ where, take: 10, select: { id: true, name: true, city: true, totalOrderValue: true, totalOrders: true, channelPreference: true } })
    ]);
    if (!countResult.cached) await redis.set(cacheKey, String(countResult.count), "EX", 300);
    return Response.json({ count: countResult.count, countCached: countResult.cached, customers });
  } catch (error) { return isResponse(error) ? error : apiError(error); }
}

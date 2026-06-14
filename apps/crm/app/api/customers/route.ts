import { db } from "../../../lib/core/db";
import { executeSegmentDSL } from "../../../lib/segments/execute";
import { isResponse, requireRole } from "../../../lib/auth/rbac";

export async function GET(request: Request): Promise<Response> {
  let actor; try { actor = await requireRole("ANALYST"); } catch (error) { return isResponse(error) ? error : Response.json({ error: "Forbidden" }, { status: 403 }); }
  const url = new URL(request.url);
  const segmentId = url.searchParams.get("segment");
  const cursor = url.searchParams.get("cursor");
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 25)));
  const query = url.searchParams.get("q")?.trim();
  const sort = url.searchParams.get("sort") ?? "name";
  const direction = url.searchParams.get("direction") === "desc" ? "desc" : "asc";
  const allowedSorts = ["name", "createdAt", "lastOrderAt", "totalOrderValue", "totalOrders"] as const;
  const sortField = allowedSorts.includes(sort as typeof allowedSorts[number]) ? sort as typeof allowedSorts[number] : "name";
  const segment = segmentId ? await db.segment.findFirst({ where: { id: segmentId, organizationId: actor.organizationId }, select: { filterRules: true } }) : null;
  const segmentWhere = segment ? executeSegmentDSL(segment.filterRules) : {};
  const customers = await db.customer.findMany({
    where: { AND: [{ organizationId: actor.organizationId }, segmentWhere, query ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { email: { contains: query, mode: "insensitive" } }] } : {}] },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: [{ [sortField]: direction }, { id: "asc" }],
    select: { id: true, externalId: true, name: true, email: true, phone: true, tags: true, city: true, ageGroup: true, gender: true, lastOrderAt: true, totalOrderValue: true, totalOrders: true, channelPreference: true, consentStatus: true, suppressedAt: true, suppressionReason: true, maxMessagesPerWeek: true }
  });
  const nextCursor = customers.length > limit ? customers[limit - 1]?.id ?? null : null;
  return Response.json({ customers: customers.slice(0, limit), nextCursor });
}

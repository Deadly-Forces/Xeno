import { createSegmentSchema } from "@xeno/shared-types";
import { db } from "../../../lib/db";
import { apiError } from "../../../lib/http";
import { executeSegmentDSL } from "../../../lib/segments/execute";
import { requireRole, isResponse } from "../../../lib/rbac";
import { audit } from "../../../lib/audit";

export async function GET(): Promise<Response> {
  try { const actor = await requireRole("ANALYST"); return Response.json(await db.segment.findMany({ where: { organizationId: actor.organizationId }, orderBy: { createdAt: "desc" }, select: { id: true, name: true, description: true, customerCount: true, createdAt: true, createdBy: true, filterRules: true } })); }
  catch (error) { return isResponse(error) ? error : Response.json({ error: "Forbidden" }, { status: 403 }); }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const actor = await requireRole("MARKETER");
    const input = createSegmentSchema.parse(await request.json());
    const count = await db.customer.count({ where: { AND: [{ organizationId: actor.organizationId }, executeSegmentDSL(input.rules)] } });
    const segment = await db.segment.create({ data: { organizationId: actor.organizationId, name: input.name, description: input.description, filterRules: input.rules, customerCount: count, createdBy: input.createdBy }, select: { id: true, name: true, customerCount: true } });
    await audit(actor, "segment.create", "Segment", segment.id, { customerCount: count, createdBy: input.createdBy });
    return Response.json(segment, { status: 201 });
  } catch (error) { return isResponse(error) ? error : apiError(error); }
}

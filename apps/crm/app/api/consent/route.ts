import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { db } from "../../../lib/core/db";
import { env } from "../../../lib/core/env";

const schema = z.object({ organizationSlug: z.string(), customerExternalId: z.string(), status: z.enum(["OPTED_IN", "OPTED_OUT"]), reason: z.string().max(300).optional() });
export async function POST(request: Request): Promise<Response> {
  const body = await request.text(); const signature = request.headers.get("x-consent-signature");
  const expected = createHmac("sha256", env.COMMERCE_HMAC_SECRET).update(body).digest(); const received = signature ? Buffer.from(signature, "hex") : Buffer.alloc(0);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return Response.json({ error: "Invalid signature" }, { status: 401 });
  let payload: unknown; try { payload = JSON.parse(body); } catch { return Response.json({ error: "Malformed JSON" }, { status: 400 }); }
  const input = schema.safeParse(payload); if (!input.success) return Response.json({ error: "Invalid consent event" }, { status: 400 });
  const organization = await db.organization.findUnique({ where: { slug: input.data.organizationSlug }, select: { id: true } }); if (!organization) return Response.json({ error: "Unknown organization" }, { status: 404 });
  const updated = await db.customer.updateMany({ where: { organizationId: organization.id, externalId: input.data.customerExternalId }, data: { consentStatus: input.data.status, consentUpdatedAt: new Date(), suppressedAt: input.data.status === "OPTED_OUT" ? new Date() : null, suppressionReason: input.data.status === "OPTED_OUT" ? input.data.reason ?? "UNSUBSCRIBED" : null } });
  return Response.json({ updated: updated.count });
}

import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { db } from "../../../../lib/core/db";
import { env } from "../../../../lib/core/env";
import { rateLimit } from "../../../../lib/security/rate-limit";

const schema = z.object({ organizationSlug: z.string().min(1), externalOrderId: z.string().min(1), customerExternalId: z.string().min(1), totalAmount: z.number().nonnegative(), status: z.string().default("PAID"), createdAt: z.string().datetime(), items: z.array(z.object({ product: z.string(), quantity: z.number().int().positive(), unitPrice: z.number().nonnegative() })).min(1) });
function valid(body: string, signature: string | null): boolean { if (!signature) return false; const expected = createHmac("sha256", env.COMMERCE_HMAC_SECRET).update(body).digest(); const received = Buffer.from(signature, "hex"); return expected.length === received.length && timingSafeEqual(expected, received); }

export async function POST(request: Request): Promise<Response> {
  const body = await request.text();
  if (!valid(body, request.headers.get("x-commerce-signature"))) return Response.json({ error: "Invalid signature" }, { status: 401 });
  let payload: unknown;
  try { payload = JSON.parse(body); } catch { return Response.json({ error: "Malformed JSON" }, { status: 400 }); }
  const input = schema.safeParse(payload);
  if (!input.success) return Response.json({ error: "Invalid order", details: input.error.flatten() }, { status: 400 });
  const limit = await rateLimit(`commerce:${input.data.organizationSlug}`, 1_000, 60);
  if (!limit.allowed) return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
  const organization = await db.organization.findUnique({ where: { slug: input.data.organizationSlug }, select: { id: true } });
  if (!organization) return Response.json({ error: "Unknown organization" }, { status: 404 });
  const customer = await db.customer.findFirst({ where: { organizationId: organization.id, externalId: input.data.customerExternalId }, select: { id: true } });
  if (!customer) return Response.json({ error: "Unknown customer" }, { status: 404 });
  const createdAt = new Date(input.data.createdAt);
  const result = await db.$transaction(async (transaction) => {
    const existing = await transaction.order.findFirst({ where: { customerId: customer.id, externalOrderId: input.data.externalOrderId }, select: { id: true } });
    if (existing) return { orderId: existing.id, duplicate: true, attributed: false };
    const order = await transaction.order.create({ data: { customerId: customer.id, externalOrderId: input.data.externalOrderId, items: input.data.items, totalAmount: input.data.totalAmount, status: input.data.status, createdAt }, select: { id: true } });
    await transaction.customer.update({ where: { id: customer.id }, data: { totalOrders: { increment: 1 }, totalOrderValue: { increment: input.data.totalAmount }, lastOrderAt: createdAt } });
    const message = await transaction.campaignMessage.findFirst({ where: { customerId: customer.id, clickedAt: { lte: createdAt, gte: new Date(createdAt.getTime() - 7 * 86_400_000) }, campaign: { organizationId: organization.id } }, orderBy: { clickedAt: "desc" }, select: { id: true } });
    if (message) await transaction.conversionEvent.create({ data: { campaignMessageId: message.id, customerId: customer.id, orderId: order.id, revenue: input.data.totalAmount } });
    return { orderId: order.id, duplicate: false, attributed: Boolean(message) };
  });
  return Response.json(result, { status: result.duplicate ? 200 : 201 });
}

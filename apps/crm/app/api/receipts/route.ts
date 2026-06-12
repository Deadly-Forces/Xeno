import { createHmac, timingSafeEqual } from "node:crypto";
import { receiptSchema } from "@xeno/shared-types";
import { db } from "../../../lib/db";
import { env } from "../../../lib/env";
import { receiptBatcher } from "../../../lib/receipts/batcher";
import { rateLimit } from "../../../lib/rate-limit";

function validSignature(body: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", env.RECEIPT_HMAC_SECRET).update(body).digest();
  let received: Buffer;
  try { received = Buffer.from(signature, "hex"); } catch { return false; }
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function POST(request: Request): Promise<Response> {
  const signatureIdentity = request.headers.get("x-channel-signature")?.slice(0, 16) ?? "unsigned";
  const limit = await rateLimit(`receipts:${signatureIdentity}`, 5_000, 60);
  if (!limit.allowed) return Response.json({ error: "Receipt rate limit exceeded" }, { status: 429, headers: { "retry-after": "60" } });
  const body = await request.text();
  if (!validSignature(body, request.headers.get("x-channel-signature"))) return Response.json({ error: "Invalid signature" }, { status: 401 });
  let decoded: unknown;
  try { decoded = JSON.parse(body); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const payload = receiptSchema.safeParse(decoded);
  if (!payload.success) return Response.json({ error: "Invalid receipt", details: payload.error.flatten() }, { status: 400 });
  const message = await db.campaignMessage.findUnique({ where: { externalMessageId: payload.data.externalId }, select: { id: true, campaignId: true } });
  if (!message) {
    console.warn(JSON.stringify({ level: "warn", event: "orphan_receipt", externalId: payload.data.externalId }));
    return Response.json({ accepted: true, orphan: true });
  }
  const timestamp = new Date(payload.data.timestamp);
  await receiptBatcher.enqueue({ campaignMessageId: message.id, campaignId: message.campaignId, event: payload.data.event, timestamp, ...(payload.data.reason ? { reason: payload.data.reason } : {}) });
  return Response.json({ accepted: true });
}

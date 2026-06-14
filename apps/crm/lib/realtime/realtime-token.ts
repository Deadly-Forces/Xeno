import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../core/env";

export function createRealtimeToken(input: { organizationId: string; userId: string; campaignId: string; expiresAt: number }): string {
  const payload = Buffer.from(JSON.stringify(input)).toString("base64url");
  const signature = createHmac("sha256", env.NEXTAUTH_SECRET).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}
export function verifyRealtimeToken(token: string): { organizationId: string; userId: string; campaignId: string; expiresAt: number } | null {
  const [payload, signature] = token.split("."); if (!payload || !signature) return null;
  const expected = createHmac("sha256", env.NEXTAUTH_SECRET).update(payload).digest(); const received = Buffer.from(signature, "base64url");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  const decoded = JSON.parse(Buffer.from(payload, "base64url").toString()) as { organizationId: string; userId: string; campaignId: string; expiresAt: number };
  return decoded.expiresAt > Date.now() ? decoded : null;
}

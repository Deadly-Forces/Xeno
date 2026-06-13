import { createHmac, randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "../lib/db";
import { campaignQueue, redis } from "../lib/queue";
import { env } from "../lib/env";
import { POST as launchRoute } from "../app/api/campaigns/[id]/launch/route";
import { POST as receiptRoute } from "../app/api/receipts/route";

const createdCampaigns: string[] = [];
const createdSegments: string[] = [];
const createdCustomers: string[] = [];

async function fixture(city: string): Promise<{ campaignId: string; customerId: string }> {
  const identity = randomUUID().replaceAll("-", "");
  const customer = await db.customer.create({ data: { organizationId: "org_xeno_default", externalId: `TEST-${identity}`, name: "Integration Customer", email: `${identity}@example.com`, phone: `+1555${identity.slice(0, 7)}`, tags: ["integration"], city, ageGroup: "26-40", gender: "non-binary", totalOrderValue: 600, totalOrders: 1, lastOrderAt: new Date(), channelPreference: "SMS", consentStatus: "OPTED_IN" }, select: { id: true } });
  createdCustomers.push(customer.id);
  const segment = await db.segment.create({ data: { organizationId: "org_xeno_default", name: `Integration ${city}`, description: "Integration fixture", filterRules: { operator: "AND", rules: [{ field: "city", operator: "eq", value: city }] }, customerCount: 1, createdBy: "human" }, select: { id: true } });
  createdSegments.push(segment.id);
  const campaign = await db.campaign.create({ data: { organizationId: "org_xeno_default", name: `Integration ${city}`, segmentId: segment.id, channel: "SMS", messageTemplate: "Hi {{name}}", status: "DRAFT" }, select: { id: true } });
  createdCampaigns.push(campaign.id);
  return { campaignId: campaign.id, customerId: customer.id };
}

describe("campaign integration", () => {
  it("enqueues one BullMQ delivery job per segment customer", async () => {
    const fixtureData = await fixture(`Launch-${randomUUID()}`);
    const response = await launchRoute(new Request("http://localhost/api/campaigns/launch", { method: "POST" }), { params: Promise.resolve({ id: fixtureData.campaignId }) });
    expect(response.status).toBe(202);
    const body = await response.json() as { enqueued: number };
    expect(body.enqueued).toBe(1);
    const message = await db.campaignMessage.findUniqueOrThrow({ where: { campaignId_customerId: { campaignId: fixtureData.campaignId, customerId: fixtureData.customerId } }, select: { id: true } });
    expect(await campaignQueue.getJob(message.id)).not.toBeNull();
  });

  it("persists stable experiment assignments and decision snapshots", async () => {
    const fixtureData = await fixture(`Experiment-${randomUUID()}`);
    await db.campaignExperiment.create({ data: { campaignId: fixtureData.campaignId, hypothesis: "Treatment improves conversion", variants: { create: [
      { name: "Control", kind: "CONTROL", messageTemplate: "Control {{name}}" },
      { name: "Treatment", kind: "TREATMENT", messageTemplate: "Treatment {{name}}" }
    ] } } });
    const response = await launchRoute(new Request("http://localhost/api/campaigns/launch", { method: "POST" }), { params: Promise.resolve({ id: fixtureData.campaignId }) });
    expect(response.status).toBe(202);
    const message = await db.campaignMessage.findUniqueOrThrow({ where: { campaignId_customerId: { campaignId: fixtureData.campaignId, customerId: fixtureData.customerId } }, select: { variantId: true, decisionScore: true, expectedRevenue: true, recommendationReasons: true } });
    expect(message.variantId).not.toBeNull();
    expect(message.decisionScore).toBeGreaterThan(0);
    expect(Number(message.expectedRevenue)).toBeGreaterThan(0);
    expect(Array.isArray(message.recommendationReasons)).toBe(true);
  });

  it("stores a duplicate receipt event exactly once", async () => {
    const fixtureData = await fixture(`Receipt-${randomUUID()}`);
    const externalMessageId = randomUUID();
    const message = await db.campaignMessage.create({ data: { campaignId: fixtureData.campaignId, customerId: fixtureData.customerId, personalizedMessage: "Hello", status: "SENT", externalMessageId }, select: { id: true } });
    const payload = JSON.stringify({ externalId: externalMessageId, event: "DELIVERED", timestamp: new Date().toISOString() });
    const signature = createHmac("sha256", env.RECEIPT_HMAC_SECRET).update(payload).digest("hex");
    const request = (): Request => new Request("http://localhost/api/receipts", { method: "POST", headers: { "content-type": "application/json", "x-channel-signature": signature }, body: payload });
    expect((await receiptRoute(request())).status).toBe(200);
    expect((await receiptRoute(request())).status).toBe(200);
    expect(await db.receiptEvent.count({ where: { campaignMessageId: message.id, event: "DELIVERED" } })).toBe(1);
  });

  it("does not regress message status when an older receipt arrives late", async () => {
    const fixtureData = await fixture(`Monotonic-${randomUUID()}`);
    const externalMessageId = randomUUID();
    const message = await db.campaignMessage.create({ data: { campaignId: fixtureData.campaignId, customerId: fixtureData.customerId, personalizedMessage: "Hello", status: "OPENED", deliveredAt: new Date(), openedAt: new Date(), externalMessageId }, select: { id: true } });
    const payload = JSON.stringify({ externalId: externalMessageId, event: "DELIVERED", timestamp: new Date().toISOString() });
    const signature = createHmac("sha256", env.RECEIPT_HMAC_SECRET).update(payload).digest("hex");
    const response = await receiptRoute(new Request("http://localhost/api/receipts", { method: "POST", headers: { "content-type": "application/json", "x-channel-signature": signature }, body: payload }));

    expect(response.status).toBe(200);
    expect((await db.campaignMessage.findUniqueOrThrow({ where: { id: message.id }, select: { status: true } })).status).toBe("OPENED");
    expect(await db.receiptEvent.count({ where: { campaignMessageId: message.id, event: "DELIVERED" } })).toBe(1);
  });
});

afterAll(async () => {
  for (const campaignId of createdCampaigns) {
    const messages = await db.campaignMessage.findMany({ where: { campaignId }, select: { id: true } });
    for (const message of messages) await (await campaignQueue.getJob(message.id))?.remove();
    await (await campaignQueue.getJob(`finalize-${campaignId}`))?.remove();
  }
  await db.campaign.deleteMany({ where: { id: { in: createdCampaigns } } });
  await db.segment.deleteMany({ where: { id: { in: createdSegments } } });
  await db.customer.deleteMany({ where: { id: { in: createdCustomers } } });
  await campaignQueue.close();
  await redis.quit();
  await db.$disconnect();
});

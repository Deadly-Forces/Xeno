import { generateText, tool } from "ai";
import { z } from "zod";
import { segmentDslSchema } from "@xeno/shared-types";
import { db } from "../db";
import { executeSegmentDSL } from "../segments/execute";
import { crmLanguageModel } from "./model";
import { launchCampaign } from "../campaigns/launch";
import { normalizeSegmentDslCandidate } from "./segment-normalizer";

export function buildDraftPrompt(marketerRequest: string, channel: string, tone: string, segmentSummary: string): string {
  return `Original marketer request: ${marketerRequest}\nChannel: ${channel}\nTone: ${tone}\nAudience: ${segmentSummary}`;
}

async function createAndLaunchAllCustomersCampaign(input: { campaignName: string; channel: "WHATSAPP" | "SMS" | "EMAIL" | "RCS"; messageTemplate: string }, organizationId: string): Promise<{ campaignId: string; enqueued: number; excluded: number; name: string }> {
  const customerCount = await db.customer.count({ where: { organizationId } });
  const existingSegment = await db.segment.findFirst({ where: { organizationId, name: "All Customers" }, select: { id: true } });
  const segment = existingSegment ?? await db.segment.create({
    data: {
      organizationId, name: "All Customers",
      description: "Every customer in the CRM",
      filterRules: { operator: "AND", rules: [] },
      customerCount,
      createdBy: "ai"
    },
    select: { id: true }
  });
  if (existingSegment) await db.segment.update({ where: { id: segment.id }, data: { customerCount }, select: { id: true } });
  const campaign = await db.campaign.create({
    data: {
      organizationId, name: input.campaignName,
      segmentId: segment.id,
      channel: input.channel,
      messageTemplate: input.messageTemplate,
      aiGenerated: true
    },
    select: { id: true, name: true }
  });
  const launched = await launchCampaign(campaign.id, organizationId);
  return { ...launched, name: campaign.name };
}

export function createCrmTools(marketerRequest = "", organizationId = "org_xeno_default") {
  return {
  create_segment: tool({
    description: "Create and persist a customer segment. Put the complete segment DSL object in rulesJson as valid JSON.",
    inputSchema: z.object({
      name: z.string().trim().min(2).max(100),
      description: z.string().trim().max(500),
      rulesJson: z.string().min(2).describe("JSON-encoded segment DSL with operator and rules")
    }),
    execute: async (input) => {
      try {
        const rules = segmentDslSchema.parse(normalizeSegmentDslCandidate(JSON.parse(input.rulesJson) as unknown));
        const count = await db.customer.count({ where: { AND: [{ organizationId }, executeSegmentDSL(rules)] } });
        return await db.segment.create({ data: { organizationId, name: input.name, description: input.description, filterRules: rules, customerCount: count, createdBy: "ai" }, select: { id: true, name: true, customerCount: true } });
      } catch (error) {
        console.warn(JSON.stringify({ level: "warn", event: "ai_segment_dsl_rejected", rulesJson: input.rulesJson, error: error instanceof Error ? error.message : "Segment creation failed" }));
        return { error: error instanceof Error ? error.message : "Segment creation failed" };
      }
    }
  }),
  draft_message: tool({
    description: "Draft a concise personalized campaign message that preserves every explicit offer, percentage, product scope, deadline, and call to action from the marketer's request.",
    inputSchema: z.object({ segmentSummary: z.string().max(2_000), channel: z.enum(["WHATSAPP", "SMS", "EMAIL", "RCS"]), tone: z.enum(["warm", "direct", "playful", "premium"]) }),
    execute: async ({ segmentSummary, channel, tone }) => {
      try {
        const result = await generateText({
          model: crmLanguageModel(),
          system: "Write only the final campaign message. Use {{name}} and optionally {{lastProduct}}. Preserve every explicit fact from the marketer request, especially percentages, discounts, product scope, dates, and calls to action. Never replace a promotional request with a generic appreciation message. Do not use Markdown. Do not invent details that the marketer did not provide.",
          prompt: buildDraftPrompt(marketerRequest, channel, tone, segmentSummary),
          abortSignal: AbortSignal.timeout(30_000)
        });
        return { channel, tone, template: result.text.trim() };
      } catch (error) { return { error: error instanceof Error ? error.message : "Message drafting failed" }; }
    }
  }),
  preview_segment: tool({
    description: "Return the current count and a small customer sample for a saved segment.",
    inputSchema: z.object({ segmentId: z.string().cuid() }),
    execute: async ({ segmentId }) => {
      try {
        const segment = await db.segment.findFirst({ where: { id: segmentId, organizationId }, select: { filterRules: true } });
        if (!segment) return { error: "Segment not found" };
        const where = { AND: [{ organizationId }, executeSegmentDSL(segment.filterRules)] };
        const [count, customers] = await Promise.all([
          db.customer.count({ where }),
          db.customer.findMany({ where, take: 5, select: { id: true, name: true, city: true, totalOrderValue: true, totalOrders: true } })
        ]);
        return { count, customers };
      } catch (error) { return { error: error instanceof Error ? error.message : "Segment preview failed" }; }
    }
  }),
  recommend_campaign: tool({
    description: "Recommend a channel and campaign angle from segment statistics.",
    inputSchema: z.object({ segmentName: z.string().min(1), customerCount: z.number().int().nonnegative(), averageOrderValue: z.number().nonnegative().optional(), daysSinceLastOrder: z.number().nonnegative().optional() }),
    execute: async ({ segmentName, customerCount, averageOrderValue, daysSinceLastOrder }) => {
      const channel = averageOrderValue && averageOrderValue >= 150 ? "WHATSAPP" : daysSinceLastOrder && daysSinceLastOrder >= 60 ? "SMS" : "EMAIL";
      const reasoning = channel === "WHATSAPP" ? "High-value audiences justify a richer conversational channel." : channel === "SMS" ? "A concise mobile reminder suits time-sensitive re-engagement." : "Email provides room for product context without high delivery cost.";
      return { segmentName, customerCount, channel, reasoning };
    }
  }),
  launch_campaign: tool({
    description: "Create and immediately launch the approved campaign to all customers. Call only after explicit confirmation such as 'send it' or 'send to all customers'. Reuse the exact approved draft as messageTemplate.",
    inputSchema: z.object({
      campaignName: z.string().trim().min(2).max(100),
      audience: z.literal("all_customers"),
      channel: z.enum(["WHATSAPP", "SMS", "EMAIL", "RCS"]),
      messageTemplate: z.string().trim().min(1).max(10_000),
      confirmed: z.literal(true)
    }),
    execute: async ({ campaignName, channel, messageTemplate }) => {
      try { return await createAndLaunchAllCustomersCampaign({ campaignName, channel, messageTemplate }, organizationId); }
      catch (error) { return { error: error instanceof Error ? error.message : "Campaign launch failed" }; }
    }
  })
  };
}

export const crmTools = createCrmTools();

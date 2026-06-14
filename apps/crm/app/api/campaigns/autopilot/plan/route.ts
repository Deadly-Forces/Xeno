import { z } from "zod";
import { db } from "../../../../../lib/db";
import { audit } from "../../../../../lib/audit";
import { apiError } from "../../../../../lib/http";
import { isResponse, requireRole } from "../../../../../lib/rbac";
import { scoreCustomer } from "../../../../../lib/decisioning/model";
import { executeSegmentDSL } from "../../../../../lib/segments/execute";

const schema = z.object({ intent: z.string().trim().min(12).max(2_000) });

function extractNumber(pattern: RegExp, value: string, fallback: number): number {
  const match = value.match(pattern);
  return match ? Number(match[1]) : fallback;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const actor = await requireRole("MARKETER");
    const { intent } = schema.parse(await request.json());
    const inactiveDays = Math.max(1, extractNumber(/(?:inactive|ordered|order)[^\d]{0,24}(\d+)\s*days?/i, intent, 60));
    const budget = Math.max(1, extractNumber(/(?:budget|exceed(?:ing)?|under|below)[^$\d]{0,12}\$?([\d,.]+)/i, intent.replaceAll(",", ""), 100));
    const explicitValue = intent.match(/(?:spent|value|ltv|high-value)[^$\d]{0,18}\$?([\d,.]+)/i);
    const valueFloor = explicitValue ? Number(explicitValue[1]?.replaceAll(",", "")) : 500;
    const cutoff = new Date(Date.now() - inactiveDays * 86_400_000);
    const rules = { operator: "AND" as const, rules: [
      { field: "totalOrderValue" as const, operator: "gt" as const, value: valueFloor },
      { field: "lastOrderAt" as const, operator: "lt" as const, value: cutoff.toISOString() }
    ] };
    const matched = await db.customer.findMany({
      where: { AND: [{ organizationId: actor.organizationId }, executeSegmentDSL(rules)] },
      select: { id: true, name: true, city: true, email: true, phone: true, totalOrderValue: true, totalOrders: true, lastOrderAt: true, channelPreference: true, consentStatus: true, suppressedAt: true, suppressionReason: true, maxMessagesPerWeek: true, campaignMessages: { where: { sentAt: { gte: new Date(Date.now() - 7 * 86_400_000) } }, select: { id: true } } }
    });
    const decisions = matched.map((customer) => ({ customer, decision: scoreCustomer(customer) }));
    const excluded = decisions.flatMap(({ customer }) => {
      const reason = customer.consentStatus !== "OPTED_IN" ? "Consent is not opted in" : customer.suppressedAt ? customer.suppressionReason ?? "Customer is suppressed" : customer.campaignMessages.length >= customer.maxMessagesPerWeek ? "Weekly frequency cap reached" : !customer.phone && !customer.email ? "No reachable channel" : null;
      return reason ? [{ id: customer.id, name: customer.name, reason }] : [];
    });
    const eligible = decisions.filter(({ customer }) => !excluded.some((item) => item.id === customer.id)).sort((a, b) => b.decision.decisionScore - a.decision.decisionScore);
    const preferenceCounts = eligible.reduce<Record<string, number>>((counts, item) => { counts[item.decision.recommendedChannel] = (counts[item.decision.recommendedChannel] ?? 0) + 1; return counts; }, {});
    const channel = (Object.entries(preferenceCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "EMAIL") as "WHATSAPP" | "SMS" | "EMAIL" | "RCS";
    const sendHour = eligible.length ? Math.round(eligible.reduce((sum, item) => sum + item.decision.recommendedSendHour, 0) / eligible.length) : 10;
    const rate = await db.providerRateCard.findFirst({ where: { organizationId: actor.organizationId, channel, effectiveFrom: { lte: new Date() }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }] }, orderBy: { effectiveFrom: "desc" } });
    const unitCost = Number(rate?.unitCost ?? (channel === "EMAIL" ? 0.006 : channel === "SMS" ? 0.018 : 0.012));
    const holdoutPercentage = eligible.length >= 40 ? 10 : eligible.length >= 20 ? 5 : 0;
    const contacted = Math.round(eligible.length * (1 - holdoutPercentage / 100));
    const estimatedCost = contacted * unitCost;
    const expectedRevenue = eligible.slice(0, contacted).reduce((sum, item) => sum + item.decision.expectedRevenue, 0);
    const segment = await db.segment.create({ data: { organizationId: actor.organizationId, name: `Autopilot: ${inactiveDays}-day high-value win-back`, description: `Customers above $${valueFloor} lifetime value with no order in ${inactiveDays} days.`, filterRules: rules, customerCount: matched.length, createdBy: "ai" }, select: { id: true, name: true, description: true } });
    const message = channel === "EMAIL" ? "Hi {{name}}, it has been a while. Come back to discover what is new for you, including picks inspired by {{lastProduct}}." : "Hi {{name}}, we miss you. Return to see new picks inspired by {{lastProduct}}.";
    const treatmentMessage = "Hi {{name}}, your next favorite may already be waiting. Revisit picks inspired by {{lastProduct}} today.";
    const plan = {
      intent, segment: { ...segment, rules, matched: matched.length, eligible: eligible.length },
      recommendation: { channel, sendHour, reasoning: `${channel} is the dominant reachable preference in the eligible audience; ${sendHour}:00 is the mean recommended send hour.` },
      copy: { control: message, treatment: treatmentMessage, hypothesis: "A curiosity-led personalized message will increase conversion versus a standard win-back reminder." },
      estimates: { reach: contacted, holdout: eligible.length - contacted, excluded: excluded.length, unitCost, cost: estimatedCost, revenue: expectedRevenue, roi: estimatedCost ? ((expectedRevenue - estimatedCost) / estimatedCost) * 100 : 0, budget, withinBudget: estimatedCost <= budget },
      included: eligible.slice(0, 8).map(({ customer, decision }) => ({ id: customer.id, name: customer.name, city: customer.city, value: Number(customer.totalOrderValue), score: decision.decisionScore, reasons: decision.reasons })),
      excluded: excluded.slice(0, 12),
      trace: [
        { step: "Intent parsed", detail: `${inactiveDays}-day inactivity, value floor $${valueFloor}, budget ceiling $${budget}.`, source: "Marketer instruction" },
        { step: "Segment executed", detail: `${matched.length} customers match the behavioral rules.`, source: "Customer database" },
        { step: "Eligibility enforced", detail: `${excluded.length} removed for consent, suppression, frequency, or reachability.`, source: "Policy engine" },
        { step: "Audience ranked", detail: `${eligible.length} eligible customers scored by conversion propensity and expected revenue.`, source: "Decision model rfm-v1" },
        { step: "Holdout assigned", detail: `${holdoutPercentage}% reserved deterministically for incremental-lift measurement.`, source: "Experiment policy" },
        { step: "Channel and time selected", detail: `${channel} at ${String(sendHour).padStart(2, "0")}:00 based on per-customer recommendations.`, source: "Decision model rfm-v1" },
        { step: "Preflight estimated", detail: `$${estimatedCost.toFixed(2)} cost and $${expectedRevenue.toFixed(2)} probability-weighted revenue.`, source: "Rate card + model scores" }
      ]
    };
    await audit(actor, "campaign.autopilot.plan", "Segment", segment.id, { intent, channel, eligible: eligible.length, excluded: excluded.length, budget });
    return Response.json(plan);
  } catch (error) { return isResponse(error) ? error : apiError(error); }
}

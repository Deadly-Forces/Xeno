import { createHash } from "node:crypto";
import type { Channel } from "@prisma/client";

export const DECISION_MODEL_VERSION = "rfm-v1";

export type DecisionCustomer = {
  id: string;
  name: string;
  totalOrderValue: number | { toString(): string };
  totalOrders: number;
  lastOrderAt: Date | null;
  channelPreference: Channel;
  conversionEvents?: Array<{ revenue: number | { toString(): string } }>;
};

export type CustomerDecision = {
  customerId: string;
  name: string;
  conversionProbability: number;
  decisionScore: number;
  expectedRevenue: number;
  churnRisk: number;
  recommendedChannel: Channel;
  recommendedSendHour: number;
  reasons: string[];
};

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

export function stableBucket(value: string, buckets = 100): number {
  const digest = createHash("sha256").update(value).digest();
  return digest.readUInt32BE(0) % buckets;
}

export function scoreCustomer(customer: DecisionCustomer, now = new Date()): CustomerDecision {
  const spend = Number(customer.totalOrderValue);
  const recencyDays = customer.lastOrderAt ? Math.max(0, (now.getTime() - customer.lastOrderAt.getTime()) / 86_400_000) : 730;
  const frequency = clamp(Math.log1p(customer.totalOrders) / Math.log(51));
  const monetary = clamp(Math.log1p(spend) / Math.log(2_501));
  const recency = Math.exp(-recencyDays / 120);
  const churnRisk = clamp(sigmoid((recencyDays - 75) / 32 - customer.totalOrders / 18));
  const conversionProbability = clamp(sigmoid(-2.1 + 1.25 * recency + 1.05 * frequency + 1.35 * monetary - 0.55 * churnRisk));
  const averageOrderValue = customer.totalOrders > 0 ? spend / customer.totalOrders : spend;
  const expectedRevenue = conversionProbability * Math.max(averageOrderValue, 10);
  const decisionScore = conversionProbability * 100;
  const recommendedSendHour = customer.channelPreference === "EMAIL" ? 9
    : customer.channelPreference === "WHATSAPP" ? 18
    : stableBucket(customer.id, 2) === 0 ? 12 : 18;
  const reasons = [
    spend >= 500 ? `High lifetime value ($${spend.toFixed(0)})` : `Lifetime value $${spend.toFixed(0)}`,
    customer.totalOrders >= 5 ? `${customer.totalOrders} prior orders indicate repeat intent` : `${customer.totalOrders} prior order${customer.totalOrders === 1 ? "" : "s"}`,
    recencyDays > 90 ? `Churn risk elevated after ${Math.round(recencyDays)} inactive days` : `Purchased ${Math.round(recencyDays)} days ago`,
    `${customer.channelPreference} matches the saved channel preference`
  ];
  return {
    customerId: customer.id,
    name: customer.name,
    conversionProbability,
    decisionScore,
    expectedRevenue,
    churnRisk,
    recommendedChannel: customer.channelPreference,
    recommendedSendHour,
    reasons
  };
}

export function rankCustomers(customers: DecisionCustomer[], now = new Date()): CustomerDecision[] {
  return customers.map((customer) => scoreCustomer(customer, now)).sort((left, right) => right.decisionScore - left.decisionScore);
}

export function evaluateRanking(customers: DecisionCustomer[], selectionRate = 0.2): {
  sampleSize: number;
  selected: number;
  ai: { conversions: number; precision: number; revenue: number };
  random: { conversions: number; precision: number; revenue: number };
  uplift: { precisionPercent: number; revenuePercent: number };
} {
  const sampleSize = customers.length;
  const selected = Math.max(1, Math.round(sampleSize * selectionRate));
  const ranked = [...customers].sort((left, right) => scoreCustomer(right).decisionScore - scoreCustomer(left).decisionScore).slice(0, selected);
  const random = [...customers].sort((left, right) => stableBucket(`benchmark:${left.id}`, 1_000_000) - stableBucket(`benchmark:${right.id}`, 1_000_000)).slice(0, selected);
  const metrics = (cohort: DecisionCustomer[]) => {
    const conversions = cohort.filter((customer) => (customer.conversionEvents?.length ?? 0) > 0).length;
    const revenue = cohort.reduce((sum, customer) => sum + (customer.conversionEvents ?? []).reduce((inner, event) => inner + Number(event.revenue), 0), 0);
    return { conversions, precision: cohort.length ? conversions / cohort.length : 0, revenue };
  };
  const ai = metrics(ranked);
  const randomMetrics = metrics(random);
  const percent = (current: number, baseline: number) => baseline > 0 ? ((current - baseline) / baseline) * 100 : current > 0 ? 100 : 0;
  return {
    sampleSize,
    selected,
    ai,
    random: randomMetrics,
    uplift: { precisionPercent: percent(ai.precision, randomMetrics.precision), revenuePercent: percent(ai.revenue, randomMetrics.revenue) }
  };
}

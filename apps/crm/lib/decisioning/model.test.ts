import { describe, expect, it } from "vitest";
import { evaluateRanking, scoreCustomer, stableBucket } from "./model";

describe("decision model", () => {
  it("scores a recent repeat customer above an inactive one", () => {
    const now = new Date("2026-06-12T00:00:00.000Z");
    const recent = scoreCustomer({ id: "recent", name: "Recent", totalOrderValue: 1200, totalOrders: 12, lastOrderAt: new Date("2026-06-01T00:00:00.000Z"), channelPreference: "EMAIL" }, now);
    const inactive = scoreCustomer({ id: "inactive", name: "Inactive", totalOrderValue: 100, totalOrders: 1, lastOrderAt: new Date("2025-01-01T00:00:00.000Z"), channelPreference: "SMS" }, now);
    expect(recent.decisionScore).toBeGreaterThan(inactive.decisionScore);
    expect(inactive.churnRisk).toBeGreaterThan(recent.churnRisk);
    expect(recent.reasons).toHaveLength(4);
  });

  it("produces deterministic assignments and benchmark output", () => {
    expect(stableBucket("same-customer")).toBe(stableBucket("same-customer"));
    const customers = Array.from({ length: 20 }, (_, index) => ({
      id: `customer-${index}`,
      name: `Customer ${index}`,
      totalOrderValue: index * 100,
      totalOrders: index + 1,
      lastOrderAt: new Date(Date.now() - index * 86_400_000),
      channelPreference: "EMAIL" as const,
      conversionEvents: index > 15 ? [{ revenue: 50 }] : []
    }));
    const result = evaluateRanking(customers);
    expect(result.selected).toBe(4);
    expect(result.ai.precision).toBeGreaterThanOrEqual(result.random.precision);
  });
});

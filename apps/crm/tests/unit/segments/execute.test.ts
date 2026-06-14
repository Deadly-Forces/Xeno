import { describe, expect, it } from "vitest";
import { executeSegmentDSL, SegmentDslError } from "../../../lib/segments/execute";

describe("executeSegmentDSL", () => {
  it("returns all customers for empty rules", () => expect(executeSegmentDSL({ operator: "AND", rules: [] })).toEqual({}));
  it("translates AND", () => expect(executeSegmentDSL({ operator: "AND", rules: [{ field: "totalOrders", operator: "gt", value: 3 }] })).toEqual({ AND: [{ totalOrders: { gt: 3 } }] }));
  it("translates OR", () => expect(executeSegmentDSL({ operator: "OR", rules: [{ field: "city", operator: "eq", value: "Austin" }] })).toEqual({ OR: [{ city: "Austin" }] }));
  it("translates less-than", () => expect(executeSegmentDSL({ operator: "AND", rules: [{ field: "totalOrderValue", operator: "lt", value: 100 }] })).toEqual({ AND: [{ totalOrderValue: { lt: 100 } }] }));
  it("translates equality", () => expect(executeSegmentDSL({ operator: "AND", rules: [{ field: "channel_preference", operator: "eq", value: "SMS" }] })).toEqual({ AND: [{ channelPreference: "SMS" }] }));
  it("translates contains", () => expect(executeSegmentDSL({ operator: "AND", rules: [{ field: "tags", operator: "contains", value: "vip" }] })).toEqual({ AND: [{ tags: { has: "vip" } }] }));
  it("translates between", () => expect(executeSegmentDSL({ operator: "AND", rules: [{ field: "totalOrders", operator: "between", value: [2, 8] }] })).toEqual({ AND: [{ totalOrders: { gte: 2, lte: 8 } }] }));
  it("translates in", () => expect(executeSegmentDSL({ operator: "AND", rules: [{ field: "city", operator: "in", value: ["Austin", "Miami"] }] })).toEqual({ AND: [{ city: { in: ["Austin", "Miami"] } }] }));
  it("throws typed errors", () => expect(() => executeSegmentDSL({ operator: "AND", rules: [{ field: "purchaseScore", operator: "gt", value: 5 }] })).toThrow(SegmentDslError));
});

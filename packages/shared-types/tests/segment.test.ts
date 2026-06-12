import { describe, expect, it } from "vitest";
import { segmentDslSchema } from "../src/segment";

describe("segmentDslSchema", () => {
  it("accepts nested valid rules", () => {
    expect(segmentDslSchema.safeParse({ operator: "AND", rules: [{ field: "totalOrderValue", operator: "gt", value: 500 }, { operator: "OR", rules: [{ field: "city", operator: "in", value: ["Austin", "Miami"] }] }] }).success).toBe(true);
  });

  it.each([
    [{ operator: "XOR", rules: [] }, "operator"],
    [{ operator: "AND", rules: [{ field: "purchaseScore", operator: "gt", value: 5 }] }, "field"],
    [{ operator: "AND", rules: [{ field: "city", operator: "contains", value: "Aus" }] }, "contains"],
    [{ operator: "AND", rules: [{ field: "totalOrders", operator: "between", value: [1] }] }, "between"],
    [{ operator: "AND", rules: [{ field: "tags", operator: "contains", value: [] }] }, "Array must contain at least 1 element"]
  ])("rejects invalid DSL %#", (input, expected) => {
    const result = segmentDslSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) expect(JSON.stringify(result.error.flatten())).toContain(expected);
  });
});

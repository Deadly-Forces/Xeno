import { describe, expect, it } from "vitest";
import { segmentDslSchema } from "@xeno/shared-types";
import { buildDraftPrompt } from "./tools";
import { extractJsonObject, normalizeSegmentDslCandidate } from "./segment-normalizer";

describe("normalizeSegmentDslCandidate", () => {
  it("normalizes common model aliases before strict validation", () => {
    const normalized = normalizeSegmentDslCandidate({
      operator: "greater_than",
      rules: [{ field: "spent", operator: "greater_than", value: 500 }]
    });

    expect(segmentDslSchema.parse(normalized)).toEqual({
      operator: "AND",
      rules: [{ field: "totalOrderValue", operator: "gt", value: 500 }]
    });
  });

  it("wraps a single condition in an AND group", () => {
    const normalized = normalizeSegmentDslCandidate({ field: "total_spent", operator: "greater_than", value: 500 });
    expect(segmentDslSchema.safeParse(normalized).success).toBe(true);
  });
});

describe("buildDraftPrompt", () => {
  it("preserves the marketer's numerical offer and product scope verbatim", () => {
    const request = "Create a WhatsApp message for all customers saying there is 30% off all products if they shop within 30 minutes.";
    const prompt = buildDraftPrompt(request, "WHATSAPP", "direct", "All customers");

    expect(prompt).toContain("30% off all products");
    expect(prompt).toContain("within 30 minutes");
    expect(prompt).toContain(request);
  });
});

describe("extractJsonObject", () => {
  it("extracts JSON from a fenced model response", () => {
    expect(extractJsonObject("Result:\n```json\n{\"rules\":{\"operator\":\"AND\",\"rules\":[]},\"explanation\":\"All customers\"}\n```"))
      .toEqual({ rules: { operator: "AND", rules: [] }, explanation: "All customers" });
  });
});

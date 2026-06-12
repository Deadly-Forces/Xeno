import { describe, expect, it } from "vitest";
import { experimentResult } from "./stats";

describe("experiment statistics", () => {
  it("does not call tiny samples statistically significant", () => {
    const result = experimentResult(
      { kind: "CONTROL", recipients: 10, conversions: 1, revenue: 20 },
      { kind: "TREATMENT", recipients: 10, conversions: 2, revenue: 40 }
    );
    expect(result.upliftPercent).toBe(100);
    expect(result.significant).toBe(false);
    expect(result.winner).toBe("INCONCLUSIVE");
  });
});

import { describe, expect, it } from "vitest";
import { buildAutopilotCopy, extractCustomerOffer } from "../../../lib/campaigns/autopilot-copy";

describe("autopilot campaign copy", () => {
  it("preserves a win-back cash offer in both variants", () => {
    const copy = buildAutopilotCopy("high value customer can win back $100", "SMS");

    expect(copy.control).toContain("win back $100");
    expect(copy.treatment).toContain("win back $100");
    expect(copy.hypothesis).toContain("win back $100");
  });

  it("preserves a percentage offer", () => {
    const copy = buildAutopilotCopy("Offer inactive customers 30% off all products", "EMAIL");

    expect(copy.control).toContain("30% off all products");
    expect(copy.treatment).toContain("30% off all products");
  });

  it("does not expose an operational budget as a customer offer", () => {
    const intent = "Win back high-value shoppers without exceeding a $100 budget";

    expect(extractCustomerOffer(intent)).toBeNull();
    expect(buildAutopilotCopy(intent, "SMS").control).not.toContain("$100");
  });
});

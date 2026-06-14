import { describe, expect, it } from "vitest";
import { rejectCrossSiteRequest, rejectOversizedRequest } from "../../../lib/security/request-security";

describe("request security", () => {
  it("rejects cross-site mutations", () => {
    const request = new Request("https://crm.example.com/api/ai/chat", { method: "POST", headers: { origin: "https://attacker.example", "sec-fetch-site": "cross-site" } });
    expect(rejectCrossSiteRequest(request)?.status).toBe(403);
  });

  it("allows same-origin mutations", () => {
    const request = new Request("https://crm.example.com/api/ai/chat", { method: "POST", headers: { origin: "https://crm.example.com", "sec-fetch-site": "same-origin" } });
    expect(rejectCrossSiteRequest(request)).toBeNull();
  });

  it("rejects oversized bodies before parsing", () => {
    const request = new Request("https://crm.example.com/api/ai/chat", { method: "POST", headers: { "content-length": "500001" } });
    expect(rejectOversizedRequest(request, 250_000)?.status).toBe(413);
  });
});

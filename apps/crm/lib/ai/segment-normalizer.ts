const operatorAliases: Record<string, string> = {
  ">": "gt",
  "<": "lt",
  "=": "eq",
  "==": "eq",
  greater_than: "gt",
  less_than: "lt",
  equals: "eq",
  equal: "eq",
  includes: "contains"
};

const fieldAliases: Record<string, string> = {
  spent: "totalOrderValue",
  total_spent: "totalOrderValue",
  lifetime_value: "totalOrderValue",
  order_count: "totalOrders",
  last_order_at: "lastOrderAt",
  channelPreference: "channel_preference"
};

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function normalizeSegmentNode(value: unknown): unknown {
  const candidate = record(value);
  if (!candidate) return value;
  const rawRules = Array.isArray(candidate.rules) ? candidate.rules : null;
  if (rawRules) {
    const groupOperator = candidate.operator === "OR" ? "OR" : "AND";
    return { operator: groupOperator, rules: rawRules.map(normalizeSegmentNode) };
  }
  const rawOperator = typeof candidate.operator === "string" ? candidate.operator : "";
  const rawField = typeof candidate.field === "string" ? candidate.field : "";
  return { field: fieldAliases[rawField] ?? rawField, operator: operatorAliases[rawOperator] ?? rawOperator, value: candidate.value };
}

export function normalizeSegmentDslCandidate(value: unknown): unknown {
  const candidate = record(value);
  if (!candidate) return value;
  if (!Array.isArray(candidate.rules) && typeof candidate.field === "string") {
    return { operator: "AND", rules: [normalizeSegmentNode(candidate)] };
  }
  return normalizeSegmentNode(candidate);
}

export function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  if (!candidate.trim()) throw new Error("AI response did not contain a JSON object");
  return JSON.parse(candidate) as unknown;
}

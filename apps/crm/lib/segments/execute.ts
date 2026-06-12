import type { Prisma } from "@prisma/client";
import { segmentDslSchema, type SegmentCondition, type SegmentDSL } from "@xeno/shared-types";

export class SegmentDslError extends Error {
  override readonly name = "SegmentDslError";
}

const validFields = ["totalOrderValue", "lastOrderAt", "totalOrders", "tags", "city", "channel_preference"] as const;

function assertKnownFields(input: unknown): void {
  if (typeof input !== "object" || input === null) return;
  if ("field" in input && typeof input.field === "string" && !validFields.includes(input.field as typeof validFields[number])) {
    throw new SegmentDslError(`Field '${input.field}' does not exist. Valid fields are: ${validFields.join(", ")}`);
  }
  if ("rules" in input && Array.isArray(input.rules)) input.rules.forEach(assertKnownFields);
}

function conditionToWhere(condition: SegmentCondition): Prisma.CustomerWhereInput {
  const { field, operator, value } = condition;
  if (field === "tags") {
    if (operator === "contains" && typeof value === "string") return { tags: { has: value } };
    if (operator === "in" && Array.isArray(value)) return { tags: { hasSome: value.map(String) } };
    if (operator === "eq" && typeof value === "string") return { tags: { has: value } };
    throw new SegmentDslError(`Operator '${operator}' is invalid for tags`);
  }

  if (field === "city") {
    if (operator === "eq" && typeof value === "string") return { city: value };
    if (operator === "in" && Array.isArray(value)) return { city: { in: value.map(String) } };
    throw new SegmentDslError(`Operator '${operator}' is invalid for city`);
  }

  if (field === "channel_preference") {
    const accepted = ["WHATSAPP", "SMS", "EMAIL", "RCS"] as const;
    const values = (Array.isArray(value) ? value : [value]).map(String);
    if (values.some((item) => !accepted.includes(item as typeof accepted[number]))) {
      throw new SegmentDslError("channel_preference contains an unsupported channel");
    }
    if (operator === "eq") return { channelPreference: values[0] as typeof accepted[number] };
    if (operator === "in") return { channelPreference: { in: values as Array<typeof accepted[number]> } };
    throw new SegmentDslError(`Operator '${operator}' is invalid for channel_preference`);
  }

  if (field === "lastOrderAt") {
    const date = (raw: string | number): Date => {
      const parsed = new Date(raw);
      if (Number.isNaN(parsed.valueOf())) throw new SegmentDslError(`Invalid date '${raw}'`);
      return parsed;
    };
    if (operator === "gt" && !Array.isArray(value)) return { lastOrderAt: { gt: date(value) } };
    if (operator === "lt" && !Array.isArray(value)) return { lastOrderAt: { lt: date(value) } };
    if (operator === "eq" && !Array.isArray(value)) return { lastOrderAt: date(value) };
    if (operator === "between" && Array.isArray(value) && value.length === 2) return { lastOrderAt: { gte: date(value[0]!), lte: date(value[1]!) } };
    throw new SegmentDslError(`Operator '${operator}' is invalid for lastOrderAt`);
  }

  const numberValue = (raw: string | number): number => {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) throw new SegmentDslError(`Invalid number '${raw}'`);
    return parsed;
  };
  const target = field === "totalOrderValue" ? "totalOrderValue" : "totalOrders";
  if (operator === "gt" && !Array.isArray(value)) return { [target]: { gt: numberValue(value) } };
  if (operator === "lt" && !Array.isArray(value)) return { [target]: { lt: numberValue(value) } };
  if (operator === "eq" && !Array.isArray(value)) return { [target]: numberValue(value) };
  if (operator === "between" && Array.isArray(value) && value.length === 2) return { [target]: { gte: numberValue(value[0]!), lte: numberValue(value[1]!) } };
  if (operator === "in" && Array.isArray(value)) return { [target]: { in: value.map((item) => numberValue(item)) } };
  throw new SegmentDslError(`Operator '${operator}' is invalid for ${field}`);
}

function groupToWhere(group: SegmentDSL): Prisma.CustomerWhereInput {
  const nested = group.rules.map((rule) => "rules" in rule ? groupToWhere(rule) : conditionToWhere(rule));
  return group.operator === "AND" ? { AND: nested } : { OR: nested };
}

export function executeSegmentDSL(input: unknown): Prisma.CustomerWhereInput {
  assertKnownFields(input);
  const parsed = segmentDslSchema.safeParse(input);
  if (!parsed.success) throw new SegmentDslError(parsed.error.issues.map((issue) => issue.message).join("; "));
  if (parsed.data.rules.length === 0) return {};
  return groupToWhere(parsed.data);
}

import { z } from "zod";

export const segmentFields = [
  "totalOrderValue",
  "lastOrderAt",
  "totalOrders",
  "tags",
  "city",
  "channel_preference"
] as const;
export const segmentOperators = ["gt", "lt", "eq", "contains", "between", "in"] as const;

export const segmentConditionSchema = z.object({
  field: z.enum(segmentFields),
  operator: z.enum(segmentOperators),
  value: z.union([
    z.string(),
    z.number(),
    z.array(z.string()).min(1),
    z.array(z.number()).length(2),
    z.tuple([z.string(), z.string()])
  ])
}).superRefine((condition, context) => {
  const numeric = condition.field === "totalOrderValue" || condition.field === "totalOrders";
  if (numeric && !(["gt", "lt", "eq", "between", "in"] as const).includes(condition.operator as "gt")) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: `${condition.operator} is invalid for ${condition.field}` });
  }
  if (condition.operator === "between" && (!Array.isArray(condition.value) || condition.value.length !== 2)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "between requires exactly two values" });
  }
  if (condition.operator === "contains" && condition.field !== "tags") {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "contains is only valid for tags" });
  }
});

export type SegmentCondition = z.infer<typeof segmentConditionSchema>;

export type SegmentGroup = {
  operator: "AND" | "OR";
  rules: Array<SegmentCondition | SegmentGroup>;
};

export const segmentGroupSchema: z.ZodType<SegmentGroup> = z.lazy(() => z.object({
  operator: z.enum(["AND", "OR"]),
  rules: z.array(z.union([segmentConditionSchema, segmentGroupSchema])).max(50)
}));

export const segmentDslSchema = segmentGroupSchema;
export type SegmentDSL = z.infer<typeof segmentDslSchema>;

export const createSegmentSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).default(""),
  rules: segmentDslSchema,
  createdBy: z.enum(["ai", "human"]).default("human")
});

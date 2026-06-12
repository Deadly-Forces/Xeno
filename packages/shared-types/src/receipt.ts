import { z } from "zod";

export const receiptEvents = ["DELIVERED", "OPENED", "READ", "CLICKED", "FAILED"] as const;
export const receiptEventSchema = z.enum(receiptEvents);

export const receiptSchema = z.object({
  externalId: z.string().uuid(),
  event: receiptEventSchema,
  timestamp: z.string().datetime(),
  reason: z.string().max(200).optional()
});
export type Receipt = z.infer<typeof receiptSchema>;

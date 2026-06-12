import { z } from "zod";

export const channels = ["WHATSAPP", "SMS", "EMAIL", "RCS"] as const;
export const channelSchema = z.enum(channels);
export type Channel = z.infer<typeof channelSchema>;

export const campaignStatuses = ["DRAFT", "RUNNING", "COMPLETED", "FAILED"] as const;
export const campaignStatusSchema = z.enum(campaignStatuses);
export type CampaignStatus = z.infer<typeof campaignStatusSchema>;

export const messageStatuses = ["QUEUED", "SENT", "DELIVERED", "FAILED", "OPENED", "READ", "CLICKED"] as const;
export const messageStatusSchema = z.enum(messageStatuses);
export type MessageStatus = z.infer<typeof messageStatusSchema>;

export const sendMessageSchema = z.object({
  messageId: z.string().cuid(),
  recipientPhone: z.string().min(7).max(30).nullable(),
  recipientEmail: z.string().email().nullable(),
  channel: channelSchema,
  message: z.string().min(1).max(10_000)
});
export type SendMessage = z.infer<typeof sendMessageSchema>;

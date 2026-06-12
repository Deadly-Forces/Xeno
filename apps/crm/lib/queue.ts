import { Queue, Worker, type JobsOptions } from "bullmq";
import IORedis from "ioredis";
import { db } from "./db";
import { env } from "./env";
import { createOperationalAlert } from "./alerts";

export const redis = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
type CampaignJob = { kind: "deliver"; campaignMessageId: string } | { kind: "finalize"; campaignId: string };

export const campaignQueue = new Queue<CampaignJob>("campaign-delivery", { connection: redis });
export const deadLetterQueue = new Queue<{ originalJobId: string; data: CampaignJob; error: string; failedAt: string }>("campaign-dead-letter", { connection: redis });

export const campaignJobOptions: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 1_000 },
  removeOnComplete: { count: 1_000 },
  removeOnFail: { count: 5_000 }
};

function requiredRecipient(channel: string, customer: { phone: string | null; email: string | null }): string | null {
  if (["SMS", "WHATSAPP", "RCS"].includes(channel) && !customer.phone) return "MISSING_PHONE";
  if (channel === "EMAIL" && !customer.email) return "MISSING_EMAIL";
  return null;
}

export function startCampaignWorker(): Worker<CampaignJob> {
  const worker = new Worker("campaign-delivery", async (job) => {
    if (job.data.kind === "finalize") {
      await db.campaign.updateMany({ where: { id: job.data.campaignId, status: "RUNNING" }, data: { status: "COMPLETED" } });
      await db.campaignExperiment.updateMany({ where: { campaignId: job.data.campaignId, status: "RUNNING" }, data: { status: "COMPLETED", completedAt: new Date() } });
      return;
    }
    const message = await db.campaignMessage.findUnique({
      where: { id: job.data.campaignMessageId },
      select: {
        id: true, personalizedMessage: true, status: true, actualChannel: true,
        campaign: { select: { organizationId: true, channel: true } },
        customer: { select: { phone: true, email: true } }
      }
    });
    if (!message || message.status !== "QUEUED") return;
    const channel = message.actualChannel ?? message.campaign.channel;
    const missing = requiredRecipient(channel, message.customer);
    if (missing) {
      await db.campaignMessage.update({ where: { id: message.id }, data: { status: "FAILED", failureReason: missing } });
      console.warn(JSON.stringify({ level: "warn", event: "campaign_message_skipped", campaignMessageId: message.id, reason: missing }));
      return;
    }
    const response = await fetch(`${env.CHANNEL_SERVICE_URL}/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messageId: message.id, recipientPhone: message.customer.phone, recipientEmail: message.customer.email, channel, message: message.personalizedMessage })
    });
    if (!response.ok) throw new Error(`Channel service returned ${response.status}`);
    const result = await response.json() as { accepted: boolean; externalId: string };
    if (!result.accepted) throw new Error("Channel service rejected message");
    await db.campaignMessage.update({ where: { id: message.id }, data: { status: "SENT", sentAt: new Date(), externalMessageId: result.externalId } });
    const rate = await db.providerRateCard.findFirst({ where: { organizationId: message.campaign.organizationId, channel, effectiveFrom: { lte: new Date() }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }] }, orderBy: { effectiveFrom: "desc" } });
    if (rate) await db.deliveryCostEvent.upsert({ where: { campaignMessageId_provider: { campaignMessageId: message.id, provider: rate.provider } }, update: {}, create: { organizationId: message.campaign.organizationId, campaignMessageId: message.id, provider: rate.provider, channel, countryCode: rate.countryCode, currency: rate.currency, unitCost: rate.unitCost, totalCost: rate.unitCost } });
  }, { connection: redis, concurrency: 50 });
  worker.on("failed", async (job, error) => {
    if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
    if (job.data.kind === "finalize") return;
    await deadLetterQueue.add("failed-delivery", { originalJobId: String(job.id), data: job.data, error: error.message, failedAt: new Date().toISOString() }, { removeOnComplete: { count: 1_000 }, removeOnFail: { count: 5_000 } });
    const message = await db.campaignMessage.update({ where: { id: job.data.campaignMessageId }, data: { status: "FAILED", failureReason: "CHANNEL_UNREACHABLE" }, select: { campaignId: true } });
    const campaign = await db.campaign.update({ where: { id: message.campaignId }, data: { status: "FAILED", failureReason: error.message }, select: { organizationId: true } });
    await createOperationalAlert(campaign.organizationId, "critical", "campaign-delivery", "Campaign delivery exhausted retries", { campaignId: message.campaignId, jobId: job.id, error: error.message });
  });
  return worker;
}

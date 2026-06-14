import { Queue, type JobsOptions } from "bullmq";
import IORedis from "ioredis";
import { env } from "./env";

export type CampaignJob =
  | { kind: "deliver"; campaignMessageId: string }
  | { kind: "finalize"; campaignId: string };

export const redis = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const campaignQueue = new Queue<CampaignJob>("campaign-delivery", {
  connection: redis,
});

export const deadLetterQueue = new Queue<{
  originalJobId: string;
  data: CampaignJob;
  error: string;
  failedAt: string;
}>("campaign-dead-letter", { connection: redis });

export const campaignJobOptions: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 1_000 },
  removeOnComplete: { count: 1_000 },
  removeOnFail: { count: 5_000 },
};

import { createHmac } from "node:crypto";
import { Worker } from "bullmq";
import pino from "pino";
import { env } from "../lib/env.js";
import { callbackQueue, cleanup, connection } from "../lib/queue.js";

const logger = pino({ level: env.LOG_LEVEL });
const events = [
  { event: "DELIVERED" as const, delay: 2_000, probability: 0.9 },
  { event: "OPENED" as const, delay: 7_000, probability: 0.6 },
  { event: "READ" as const, delay: 15_000, probability: 0.3 },
  { event: "CLICKED" as const, delay: 27_000, probability: 0.15 }
];

export function startWorkers(): Array<Worker> {
  const simulator = new Worker<{ externalId: string }>("channel-simulation", async (job) => {
    const fate = Math.random();
    if (fate > 0.9) {
      await callbackQueue.add("callback", { externalId: job.data.externalId, event: "FAILED", timestamp: new Date(Date.now() + 2_000).toISOString() }, { ...cleanup, delay: 2_000, attempts: 2, backoff: { type: "fixed", delay: 3_000 } });
      return;
    }
    for (const item of events) {
      if (fate <= item.probability) await callbackQueue.add("callback", { externalId: job.data.externalId, event: item.event, timestamp: new Date(Date.now() + item.delay).toISOString() }, { ...cleanup, delay: item.delay });
    }
  }, { connection, concurrency: 100 });

  const callback = new Worker<{ externalId: string; event: "DELIVERED" | "OPENED" | "READ" | "CLICKED" | "FAILED"; timestamp: string }>("channel-callback", async (job) => {
    const body = JSON.stringify(job.data);
    const signature = createHmac("sha256", env.RECEIPT_HMAC_SECRET).update(body).digest("hex");
    const response = await fetch(`${env.CRM_RECEIPT_URL}/api/receipts`, { method: "POST", headers: { "content-type": "application/json", "x-channel-signature": signature }, body });
    logger.info({ externalId: job.data.externalId, event: job.data.event, statusCode: response.status }, "receipt_callback");
    if (!response.ok) throw new Error(`CRM receipt endpoint returned ${response.status}`);
  }, { connection, concurrency: 100 });
  return [simulator, callback];
}

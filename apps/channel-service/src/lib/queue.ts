import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { env } from "./env.js";

export const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
export const simulationQueue = new Queue<{ externalId: string }>("channel-simulation", { connection });
export const callbackQueue = new Queue<{ externalId: string; event: "DELIVERED" | "OPENED" | "READ" | "CLICKED" | "FAILED"; timestamp: string }>("channel-callback", { connection });
export const cleanup = { removeOnComplete: { count: 1_000 }, removeOnFail: { count: 5_000 } } as const;

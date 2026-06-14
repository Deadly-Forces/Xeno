import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { env } from "./env.js";

export const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
export type ChaosOptions = { failureRate: number; latencyMs: number; duplicateCallbacks: boolean; outOfOrderCallbacks: boolean };
export const simulationQueue = new Queue<{ externalId: string; chaos?: ChaosOptions }>("channel-simulation", { connection });
export const callbackQueue = new Queue<{ externalId: string; event: "DELIVERED" | "OPENED" | "READ" | "CLICKED" | "FAILED"; timestamp: string }>("channel-callback", { connection });
export const cleanup = { removeOnComplete: { count: 1_000 }, removeOnFail: { count: 5_000 } } as const;

import { randomUUID } from "node:crypto";
import { sendMessageSchema } from "@xeno/shared-types";
import { Hono } from "hono";
import { cleanup, connection, simulationQueue } from "../lib/queue.js";

export const sendRoute = new Hono();

sendRoute.post("/", async (context) => {
  const input = sendMessageSchema.safeParse(await context.req.json());
  if (!input.success) return context.json({ error: "Invalid payload", details: input.error.flatten() }, 400);
  const idempotencyKey = `channel:idempotency:${input.data.messageId}`;
  const existing = await connection.get(idempotencyKey);
  if (existing) return context.json({ accepted: true as const, externalId: existing, duplicate: true as const }, 200);
  const externalId = randomUUID();
  const acquired = await connection.set(idempotencyKey, externalId, "EX", 86_400, "NX");
  if (!acquired) {
    const raced = await connection.get(idempotencyKey);
    return context.json({ accepted: true as const, externalId: raced ?? externalId, duplicate: true as const }, 200);
  }
  await simulationQueue.add("simulate", { externalId }, { ...cleanup, jobId: externalId });
  return context.json({ accepted: true as const, externalId }, 202);
});

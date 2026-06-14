import { MessageStatus, type Prisma } from "@prisma/client";
import { db } from "../core/db";
import { redis } from "../core/queue";

type ReceiptBatchEntry = {
  campaignMessageId: string;
  campaignId: string;
  event: MessageStatus;
  timestamp: Date;
  reason?: string;
  resolve: () => void;
  reject: (error: unknown) => void;
};

const progression: MessageStatus[] = [
  MessageStatus.QUEUED,
  MessageStatus.SENT,
  MessageStatus.DELIVERED,
  MessageStatus.OPENED,
  MessageStatus.READ,
  MessageStatus.CLICKED
];

function lowerStatuses(event: MessageStatus): MessageStatus[] {
  if (event === MessageStatus.FAILED) return [MessageStatus.QUEUED, MessageStatus.SENT];
  const index = progression.indexOf(event);
  return index < 0 ? [] : progression.slice(0, index);
}

function messageUpdate(entry: ReceiptBatchEntry): Prisma.CampaignMessageUpdateManyMutationInput {
  const eventTime = entry.event === MessageStatus.DELIVERED ? { deliveredAt: entry.timestamp }
    : entry.event === MessageStatus.OPENED ? { openedAt: entry.timestamp }
    : entry.event === MessageStatus.READ ? { readAt: entry.timestamp }
    : entry.event === MessageStatus.CLICKED ? { clickedAt: entry.timestamp }
    : {};
  return { status: entry.event, failureReason: entry.reason ?? null, ...eventTime };
}

function strongestEntries(entries: ReceiptBatchEntry[]): ReceiptBatchEntry[] {
  const strongest = new Map<string, ReceiptBatchEntry>();
  for (const entry of entries) {
    const current = strongest.get(entry.campaignMessageId);
    if (!current) {
      strongest.set(entry.campaignMessageId, entry);
      continue;
    }
    const currentRank = current.event === MessageStatus.FAILED ? -1 : progression.indexOf(current.event);
    const nextRank = entry.event === MessageStatus.FAILED ? -1 : progression.indexOf(entry.event);
    if (nextRank > currentRank) strongest.set(entry.campaignMessageId, entry);
  }
  return [...strongest.values()];
}

class ReceiptBatcher {
  private pending: ReceiptBatchEntry[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private flushing = false;

  enqueue(input: Omit<ReceiptBatchEntry, "resolve" | "reject">): Promise<void> {
    return new Promise((resolve, reject) => {
      this.pending.push({ ...input, resolve, reject });
      if (this.pending.length >= 100) void this.flush();
      else if (!this.timer) this.timer = setTimeout(() => void this.flush(), 20);
    });
  }

  private async flush(): Promise<void> {
    if (this.flushing || this.pending.length === 0) return;
    this.flushing = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const batch = this.pending.splice(0, 500);
    try {
      await db.$transaction(async (transaction) => {
        await transaction.receiptEvent.createMany({
          data: batch.map((entry) => ({ campaignMessageId: entry.campaignMessageId, event: entry.event, timestamp: entry.timestamp })),
          skipDuplicates: true
        });
        for (const entry of strongestEntries(batch)) {
          await transaction.campaignMessage.updateMany({
            where: { id: entry.campaignMessageId, status: { in: lowerStatuses(entry.event) } },
            data: messageUpdate(entry)
          });
        }
      });
      await Promise.all([...new Set(batch.map((entry) => entry.campaignId))].map((campaignId) => redis.del(`campaign:${campaignId}:stats`)));
      await Promise.all([...new Set(batch.map((entry) => entry.campaignId))].map((campaignId) => redis.publish(`campaign:${campaignId}:events`, JSON.stringify({ type: "receipt_batch", campaignId, received: batch.filter((entry) => entry.campaignId === campaignId).length, at: new Date().toISOString() }))));
      batch.forEach((entry) => entry.resolve());
    } catch (error) {
      batch.forEach((entry) => entry.reject(error));
    } finally {
      this.flushing = false;
      if (this.pending.length > 0) this.timer = setTimeout(() => void this.flush(), 0);
    }
  }
}

const globalReceiptBatcher = globalThis as typeof globalThis & { receiptBatcher?: ReceiptBatcher };
export const receiptBatcher = globalReceiptBatcher.receiptBatcher ?? new ReceiptBatcher();
if (process.env.NODE_ENV !== "production") globalReceiptBatcher.receiptBatcher = receiptBatcher;

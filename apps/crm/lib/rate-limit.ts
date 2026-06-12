import { redis } from "./queue";

export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number }> {
  const redisKey = `rate-limit:${key}`;
  const now = Date.now();
  const minimum = now - windowSeconds * 1_000;
  const member = `${now}:${Math.random().toString(36).slice(2)}`;
  const transaction = redis.multi();
  transaction.zremrangebyscore(redisKey, 0, minimum);
  transaction.zadd(redisKey, now, member);
  transaction.zcard(redisKey);
  transaction.pexpire(redisKey, windowSeconds * 1_000);
  const results = await transaction.exec();
  const count = Number(results?.[2]?.[1] ?? limit + 1);
  if (count > limit) await redis.zrem(redisKey, member);
  return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
}

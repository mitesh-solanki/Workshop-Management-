import "server-only";

import {
  findRateLimitBucket,
  incrementRateLimitBucket,
  upsertRateLimitBucket,
} from "@/modules/email/repo";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
};

type RedisClient = {
  incr(key: string): Promise<number>;
  pexpire(key: string, ms: number): Promise<unknown>;
  pttl(key: string): Promise<number>;
};

const globalRedis = globalThis as unknown as {
  workshopRedis?: RedisClient | null;
  workshopRedisTried?: boolean;
};

/**
 * Prefer Redis when `REDIS_URL` is set and `ioredis` can connect.
 * Falls back to a DB-backed bucket (always available).
 */
async function getRedis(): Promise<RedisClient | null> {
  if (globalRedis.workshopRedisTried) {
    return globalRedis.workshopRedis ?? null;
  }
  globalRedis.workshopRedisTried = true;

  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    globalRedis.workshopRedis = null;
    return null;
  }

  try {
    const loaded = await import("ioredis").catch(() => null);
    if (!loaded) {
      globalRedis.workshopRedis = null;
      return null;
    }
    const RedisCtor = loaded.default;
    const client = new RedisCtor(url, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: true,
      connectTimeout: 1500,
    });
    await client.connect();
    globalRedis.workshopRedis = client;
    return client;
  } catch {
    globalRedis.workshopRedis = null;
    return null;
  }
}

async function consumeRedis(input: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<RateLimitResult | null> {
  const redis = await getRedis();
  if (!redis) return null;

  try {
    const count = await redis.incr(input.key);
    if (count === 1) {
      await redis.pexpire(input.key, input.windowMs);
    }
    const ttl = await redis.pttl(input.key);
    const resetAt = new Date(Date.now() + Math.max(ttl, 0));
    return {
      allowed: count <= input.limit,
      remaining: Math.max(0, input.limit - count),
      resetAt,
    };
  } catch {
    return null;
  }
}

async function consumeDb(input: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<RateLimitResult> {
  const now = new Date();
  const existing = await findRateLimitBucket(input.key);

  if (!existing || existing.expiresAt <= now) {
    const expiresAt = new Date(now.getTime() + input.windowMs);
    await upsertRateLimitBucket({
      key: input.key,
      count: 1,
      windowStart: now,
      expiresAt,
    });
    return {
      allowed: 1 <= input.limit,
      remaining: Math.max(0, input.limit - 1),
      resetAt: expiresAt,
    };
  }

  const updated = await incrementRateLimitBucket(input.key);

  return {
    allowed: updated.count <= input.limit,
    remaining: Math.max(0, input.limit - updated.count),
    resetAt: updated.expiresAt,
  };
}

export async function consumeRateLimit(input: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<RateLimitResult> {
  const fromRedis = await consumeRedis(input);
  if (fromRedis) return fromRedis;
  return consumeDb(input);
}

export const OTP_EMAIL_RATE = {
  limit: 5,
  windowMs: 15 * 60 * 1000,
} as const;

export const OTP_IP_RATE = {
  limit: 20,
  windowMs: 15 * 60 * 1000,
} as const;

export const MAX_OTP_ATTEMPTS = 5;

export const LIVE_LINK_VIEW_RATE = {
  limit: 60,
  windowMs: 15 * 60 * 1000,
} as const;

export const LIVE_LINK_ACTION_RATE = {
  limit: 30,
  windowMs: 15 * 60 * 1000,
} as const;

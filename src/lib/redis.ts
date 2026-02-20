/**
 * Redis 클라이언트 (ioredis)
 *
 * 환경변수:
 *   REDIS_URL=redis://localhost:6379  (기본값)
 *
 * 사용법:
 *   import { redis, cache } from "@/lib/redis";
 *
 *   // 직접 사용
 *   await redis.set("key", "value", "EX", 300);
 *   const val = await redis.get("key");
 *
 *   // 캐시 헬퍼
 *   const data = await cache.getOrSet("programs:list", 300, async () => {
 *     return await fetchPrograms();
 *   });
 */
import Redis from "ioredis";
import { createLogger } from "@/lib/logger";

const log = createLogger("redis");

// REDIS_URL이 명시적으로 설정된 경우에만 Redis 사용
// 설정 안 되어 있으면 인메모리 폴백만 사용 (dev 서버 행 방지)
const REDIS_URL = process.env.REDIS_URL;
const REDIS_ENABLED = !!REDIS_URL;

// Redis 연결 (싱글턴)
let redisInstance: Redis | null = null;

export function getRedis(): Redis | null {
  if (!REDIS_ENABLED) return null;
  if (!redisInstance) {
    redisInstance = new Redis(REDIS_URL!, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      retryStrategy(times) {
        if (times > 2) {
          log.warn("Redis 재연결 최대 시도 초과, 인메모리 폴백");
          return null; // 연결 포기
        }
        return Math.min(times * 500, 2000);
      },
      lazyConnect: true,
      enableOfflineQueue: false, // 오프라인 시 큐잉 안 함 → 즉시 에러
    });

    redisInstance.on("connect", () => log.info("Redis 연결됨"));
    redisInstance.on("error", (err) => log.error({ err }, "Redis 에러"));
    redisInstance.on("close", () => log.debug("Redis 연결 닫힘"));
  }
  return redisInstance;
}

export const redis = getRedis();

// Redis 사용 가능 여부 확인
let redisAvailable: boolean | null = null;
let lastCheckTime = 0;
const RECHECK_INTERVAL = 60000; // 60초마다 재확인 (30초 → 60초)

async function isRedisAvailable(): Promise<boolean> {
  // Redis URL 자체가 없으면 항상 false
  if (!REDIS_ENABLED || !redis) {
    return false;
  }

  const now = Date.now();
  // 캐시된 결과가 있고 재확인 시간 안 됐으면 캐시 반환
  if (redisAvailable !== null && (now - lastCheckTime) < RECHECK_INTERVAL) {
    return redisAvailable;
  }

  try {
    await redis.ping();
    redisAvailable = true;
    lastCheckTime = now;
    return true;
  } catch {
    if (redisAvailable !== false) {
      log.warn("Redis 사용 불가, 인메모리 폴백 사용");
    }
    redisAvailable = false;
    lastCheckTime = now;
    return false;
  }
}

// ─── 캐시 헬퍼 ─────────────────────────────────

// 인메모리 폴백 캐시
const memCache = new Map<string, { data: unknown; expiresAt: number }>();

export const cache = {
  /**
   * 캐시에서 가져오거나 없으면 fetcher 실행 후 저장
   * Redis 불가 시 인메모리 폴백
   */
  async getOrSet<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
    const prefixedKey = `bizplan:${key}`;

    // Redis 시도
    if (await isRedisAvailable()) {
      try {
        const cached = await redis!.get(prefixedKey);
        if (cached) {
          return JSON.parse(cached) as T;
        }

        const data = await fetcher();
        await redis!.set(prefixedKey, JSON.stringify(data), "EX", ttlSeconds);
        return data;
      } catch (err) {
        log.warn({ err, key }, "Redis 캐시 실패, 인메모리 폴백");
      }
    }

    // 인메모리 폴백
    const mem = memCache.get(prefixedKey);
    if (mem && Date.now() < mem.expiresAt) {
      return mem.data as T;
    }

    const data = await fetcher();
    memCache.set(prefixedKey, { data, expiresAt: Date.now() + ttlSeconds * 1000 });
    return data;
  },

  /** 캐시 무효화 */
  async invalidate(key: string): Promise<void> {
    const prefixedKey = `bizplan:${key}`;
    memCache.delete(prefixedKey);
    if (await isRedisAvailable()) {
      try {
        await redis!.del(prefixedKey);
      } catch {
        // ignore
      }
    }
  },

  /** 패턴으로 캐시 무효화 (예: "programs:*") */
  async invalidatePattern(pattern: string): Promise<void> {
    const prefixedPattern = `bizplan:${pattern}`;

    // 인메모리
    for (const key of memCache.keys()) {
      if (key.startsWith(prefixedPattern.replace("*", ""))) {
        memCache.delete(key);
      }
    }

    // Redis
    if (await isRedisAvailable()) {
      try {
        const keys = await redis!.keys(prefixedPattern);
        if (keys.length > 0) {
          await redis!.del(...keys);
        }
      } catch {
        // ignore
      }
    }
  },
};

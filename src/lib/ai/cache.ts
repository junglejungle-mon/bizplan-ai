/**
 * AI 응답 캐싱 — 같은 프롬프트는 재사용 (Redis 또는 메모리)
 *
 * 핵심 효과:
 * - 같은 사업계획서 다시 만들 때 LLM 재호출 안 함
 * - 골든 케이스 회귀 테스트 시 결정적 결과 보장
 * - LLM 호출 비용 절감
 */
import { createHash } from 'crypto';
import type { AICallOptions, AICallResult } from './types';

interface CacheEntry {
  result: AICallResult;
  cachedAt: number;
  hits: number;
}

// Redis 동적 import (없으면 메모리 캐시 폴백)
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ioredis 타입 충돌 회피
let redis: any = null;
let redisInitTried = false;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getRedis(): Promise<any> {
  if (redisInitTried) return redis;
  redisInitTried = true;

  try {
    if (!process.env.REDIS_URL) return null;
    const Redis = (await import('ioredis')).default;
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
    });
    return redis;
  } catch {
    return null;
  }
}

// 메모리 캐시 (Redis 없을 때 폴백)
const memoryCache = new Map<string, CacheEntry>();
const MEMORY_CACHE_MAX = 1000;
const DEFAULT_TTL_SECONDS = 60 * 60 * 24; // 24시간

/**
 * 프롬프트 + 옵션 → 결정적 캐시 키
 */
export function makeCacheKey(prompt: string, options: AICallOptions = {}): string {
  const normalized = {
    prompt: prompt.trim(),
    model: options.model || 'sonnet',
    systemPrompt: (options.systemPrompt || '').trim(),
    jsonMode: options.jsonMode || false,
  };
  const hash = createHash('sha256')
    .update(JSON.stringify(normalized))
    .digest('hex')
    .slice(0, 32);
  return `ai:cache:${hash}`;
}

/**
 * 캐시 조회
 */
export async function getCached(key: string): Promise<AICallResult | null> {
  // 1. Redis 시도
  const r = await getRedis();
  if (r) {
    try {
      const raw = await r.get(key);
      if (raw) {
        const entry = JSON.parse(raw) as CacheEntry;
        return entry.result;
      }
    } catch {
      // Redis 실패 시 메모리로 폴백
    }
  }

  // 2. 메모리 캐시
  const entry = memoryCache.get(key);
  if (entry) {
    entry.hits++;
    return entry.result;
  }

  return null;
}

/**
 * 캐시 저장
 */
export async function setCached(
  key: string,
  result: AICallResult,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<void> {
  const entry: CacheEntry = {
    result,
    cachedAt: Date.now(),
    hits: 0,
  };

  // Redis 우선
  const r = await getRedis();
  if (r) {
    try {
      await r.set(key, JSON.stringify(entry), 'EX', ttlSeconds);
      return;
    } catch {
      // 실패 시 메모리
    }
  }

  // 메모리 캐시 (LRU 비슷하게 크기 제한)
  if (memoryCache.size >= MEMORY_CACHE_MAX) {
    const firstKey = memoryCache.keys().next().value;
    if (firstKey) memoryCache.delete(firstKey);
  }
  memoryCache.set(key, entry);
}

/**
 * 캐시 삭제 (특정 키 또는 전체)
 */
export async function clearCache(key?: string): Promise<void> {
  if (key) {
    const r = await getRedis();
    if (r) {
      try {
        await r.del(key);
      } catch { /* ignore */ }
    }
    memoryCache.delete(key);
    return;
  }

  // 전체 메모리 캐시 삭제
  memoryCache.clear();
}

/**
 * 캐시 통계
 */
export function getCacheStats(): {
  memorySize: number;
  redisAvailable: boolean;
  totalHits: number;
} {
  let totalHits = 0;
  for (const entry of memoryCache.values()) {
    totalHits += entry.hits;
  }
  return {
    memorySize: memoryCache.size,
    redisAvailable: redis !== null,
    totalHits,
  };
}

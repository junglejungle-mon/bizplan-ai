/**
 * Rate Limiter (Redis + 인메모리 폴백)
 *
 * Redis 사용 가능 시: 분산 환경 지원 (Vercel, 다중 인스턴스)
 * Redis 불가 시: 기존 인메모리 방식으로 자동 폴백
 */
// ─── 인메모리 Store (폴백용 + Redis 불가 시) ─────
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const memStore = new Map<string, RateLimitEntry>();

// 5분마다 만료된 항목 정리
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memStore) {
    if (now > entry.resetAt) {
      memStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Node.js가 종료되지 않도록 unref
if (cleanupInterval?.unref) cleanupInterval.unref();

// ─── 타입 ─────────────────────────────────────

interface RateLimitConfig {
  /** 윈도우당 최대 요청 수 */
  limit: number;
  /** 윈도우 크기 (ms) */
  window: number;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

// ─── Redis Rate Limit (비동기) ────────────────

let redisAvailable: boolean | null = null;

async function tryRedisRateLimit(key: string, config: RateLimitConfig): Promise<RateLimitResult | null> {
  // Redis 모듈을 동적으로 임포트 (circular dependency 방지)
  try {
    const { redis } = await import("@/lib/redis");

    if (redisAvailable === false) return null;

    const redisKey = `ratelimit:${key}`;
    const now = Date.now();
    const windowEnd = now + config.window;

    // MULTI: 원자적 카운트 증가
    const pipeline = redis!.pipeline();
    pipeline.incr(redisKey);
    pipeline.pttl(redisKey);

    const results = await pipeline.exec();
    if (!results) {
      redisAvailable = false;
      setTimeout(() => { redisAvailable = null; }, 30000);
      return null;
    }

    const count = (results[0]?.[1] as number) || 1;
    const ttl = (results[1]?.[1] as number) || -1;

    // 첫 요청이면 TTL 설정
    if (count === 1 || ttl === -1) {
      await redis!.pexpire(redisKey, config.window);
    }

    redisAvailable = true;

    if (count > config.limit) {
      const resetAt = ttl > 0 ? now + ttl : windowEnd;
      return { success: false, remaining: 0, resetAt };
    }

    const resetAt = ttl > 0 ? now + ttl : windowEnd;
    return { success: true, remaining: config.limit - count, resetAt };
  } catch {
    redisAvailable = false;
    setTimeout(() => { redisAvailable = null; }, 30000);
    return null;
  }
}

// ─── 인메모리 Rate Limit (동기) ───────────────

function memRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const entry = memStore.get(key);

  if (!entry || now > entry.resetAt) {
    memStore.set(key, { count: 1, resetAt: now + config.window });
    return { success: true, remaining: config.limit - 1, resetAt: now + config.window };
  }

  if (entry.count >= config.limit) {
    return { success: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { success: true, remaining: config.limit - entry.count, resetAt: entry.resetAt };
}

// ─── 통합 Rate Limit ─────────────────────────

/**
 * Rate limit 체크 (Redis 우선, 인메모리 폴백)
 * @param key - 식별 키 (IP, userId 등)
 * @param config - 제한 설정
 */
export async function rateLimitAsync(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
  const redisResult = await tryRedisRateLimit(key, config);
  if (redisResult) return redisResult;

  // 인메모리 폴백
  return memRateLimit(key, config);
}

/**
 * Rate limit 체크 (동기, 인메모리 전용)
 * 기존 코드 호환성 유지
 */
export function rateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  return memRateLimit(key, config);
}

/** IP 추출 헬퍼
 * x-real-ip 우선 사용 (프록시가 설정한 신뢰할 수 있는 실제 IP).
 * x-forwarded-for는 클라이언트가 위조 가능한 앞쪽 값 대신 마지막 값(프록시가 추가한 값) 사용.
 */
export function getClientIP(request: Request): string {
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",");
    return parts[parts.length - 1].trim();
  }
  return "unknown";
}

/** 사전 정의 프리셋 */
export const RATE_LIMITS = {
  /** AI 생성: 분당 5회 */
  AI_GENERATE: { limit: 5, window: 60 * 1000 },
  /** 인증: 분당 10회 */
  AUTH: { limit: 10, window: 60 * 1000 },
  /** 일반 API: 분당 60회 */
  API: { limit: 60, window: 60 * 1000 },
  /** 문의: 시간당 5회 */
  CONTACT: { limit: 5, window: 60 * 60 * 1000 },
} as const;

/** Rate limit 초과 시 Response 반환 */
export function rateLimitResponse(result: RateLimitResult): Response {
  return Response.json(
    { error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.ceil((result.resetAt - Date.now()) / 1000)),
        "X-RateLimit-Remaining": String(result.remaining),
      },
    }
  );
}

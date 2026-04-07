/**
 * AI Router — Claude CLI 우선, Gemini 폴백
 *
 * 사용법:
 *   import { callAI } from '@/lib/ai/router';
 *   const result = await callAI('프롬프트');
 *
 * 환경변수 없이도 동작 (Claude CLI 사용)
 * Claude CLI 실패 시 Gemini로 자동 폴백
 */
import type { AICallOptions, AICallResult, AIProvider } from './types';
import { claudeCliProvider } from './providers/claude-cli';
import { geminiProvider } from './providers/gemini';
import { makeCacheKey, getCached, setCached } from './cache';
import { logAICall } from './logger';

// 폴백 순서: Claude CLI → Gemini
const PROVIDER_CHAIN: AIProvider[] = [claudeCliProvider, geminiProvider];

// 캐시 사용 여부 (기본 ON, AI_CACHE=0이면 OFF)
const CACHE_ENABLED = process.env.AI_CACHE !== '0';

interface CallStats {
  totalCalls: number;
  byProvider: Record<string, number>;
  failures: Array<{ provider: string; error: string; timestamp: string }>;
}

const stats: CallStats = {
  totalCalls: 0,
  byProvider: {},
  failures: [],
};

/**
 * AI 호출 — 자동 폴백 + 캐싱 + 로깅
 */
export async function callAI(
  prompt: string,
  options: AICallOptions = {}
): Promise<AICallResult> {
  stats.totalCalls++;
  const errors: string[] = [];

  // 1. 캐시 확인
  if (CACHE_ENABLED) {
    const cacheKey = makeCacheKey(prompt, options);
    const cached = await getCached(cacheKey);
    if (cached) {
      if (process.env.AI_DEBUG === '1') {
        console.log(
          `[AI Router] 💾 cache hit (${options.context || 'no-ctx'})`
        );
      }
      // 캐시 히트도 로그
      void logAICall({ prompt, options, result: cached });
      return cached;
    }
  }

  // 2. Provider 체인 실행
  for (const provider of PROVIDER_CHAIN) {
    try {
      const result = await provider.call(prompt, options);
      stats.byProvider[provider.name] =
        (stats.byProvider[provider.name] || 0) + 1;

      if (process.env.AI_DEBUG === '1') {
        console.log(
          `[AI Router] ✅ ${provider.name} succeeded in ${result.durationMs}ms`,
          options.context ? `(${options.context})` : ''
        );
      }

      // 3. 캐시 저장
      if (CACHE_ENABLED) {
        const cacheKey = makeCacheKey(prompt, options);
        void setCached(cacheKey, result);
      }

      // 4. 로그 기록
      void logAICall({ prompt, options, result });

      return result;
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      errors.push(`${provider.name}: ${errMsg}`);
      stats.failures.push({
        provider: provider.name,
        error: errMsg,
        timestamp: new Date().toISOString(),
      });

      if (process.env.AI_DEBUG === '1') {
        console.warn(
          `[AI Router] ❌ ${provider.name} failed:`,
          errMsg.slice(0, 200)
        );
      }
    }
  }

  // 5. 전부 실패 로그
  const finalError = new Error(
    `All AI providers failed:\n${errors.join('\n')}`
  );
  void logAICall({ prompt, options, error: finalError });
  throw finalError;
}

/**
 * JSON 응답 호출 (자동 파싱)
 */
export async function callAIJson<T = unknown>(
  prompt: string,
  options: AICallOptions = {}
): Promise<{ data: T; result: AICallResult }> {
  const result = await callAI(prompt, { ...options, jsonMode: true });

  // JSON 추출 (마크다운 코드 블록 제거)
  let jsonText = result.output.trim();

  // ```json ... ``` 제거
  const codeBlockMatch = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    jsonText = codeBlockMatch[1].trim();
  }

  // 첫 { 부터 마지막 } 까지 추출
  const firstBrace = jsonText.indexOf('{');
  const lastBrace = jsonText.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1) {
    jsonText = jsonText.slice(firstBrace, lastBrace + 1);
  }

  try {
    const data = JSON.parse(jsonText) as T;
    return { data, result };
  } catch (e) {
    throw new Error(
      `Failed to parse JSON response: ${e instanceof Error ? e.message : 'unknown'}\nRaw: ${result.output.slice(0, 500)}`
    );
  }
}

/**
 * 통계 조회
 */
export function getAIStats(): Readonly<CallStats> {
  return { ...stats, byProvider: { ...stats.byProvider }, failures: [...stats.failures] };
}

/**
 * 통계 초기화
 */
export function resetAIStats(): void {
  stats.totalCalls = 0;
  stats.byProvider = {};
  stats.failures = [];
}

/**
 * 헬스체크 — 어떤 provider가 사용 가능한지
 */
export async function healthCheck(): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};
  for (const provider of PROVIDER_CHAIN) {
    results[provider.name] = await provider.isAvailable();
  }
  return results;
}

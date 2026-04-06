/**
 * AI 호출 로거 — 단계별 JSONL 로그
 *
 * 목적:
 * - 디버깅: 어디서 어떤 입력으로 어떤 출력이 나왔는지 추적
 * - 회귀 테스트: 골든 케이스 비교용 데이터
 * - 비용 분석: 호출 빈도/모델/토큰 추적
 *
 * 저장 위치:
 * - 로컬: data/ai-logs/YYYY-MM-DD/{caller}.jsonl
 * - Vercel: 스킵 (파일시스템 쓰기 불가)
 *
 * 변경 이력:
 * - Round 1: 죽은 import (writeFile, sep) 제거
 * - Round 3: turbopack 동적 패턴 경고 회피 — fs 작업을 별도 헬퍼 모듈(logger-fs)로 분리
 */
import type { AICallOptions, AICallResult } from './types';

interface LogEntry {
  timestamp: string;
  caller: string;
  source: string;
  model: string;
  durationMs: number;
  promptHash: string;
  promptLength: number;
  outputLength: number;
  inputTokens?: number;
  outputTokens?: number;
  context?: string;
  systemPrompt?: string;
  prompt?: string;
  output?: string;
  error?: string;
}

const LOG_ENABLED = process.env.AI_LOG === '1' || process.env.LOG_AI_CALLS === 'true';
const LOG_FULL = process.env.AI_LOG_FULL === '1';
const SKIP_LOGGING = !LOG_ENABLED || process.env.VERCEL === '1';

/**
 * AI 호출 로그 저장
 */
export async function logAICall(data: {
  prompt: string;
  options: AICallOptions;
  result?: AICallResult;
  error?: Error;
}): Promise<void> {
  if (SKIP_LOGGING) return;

  try {
    // logger-fs 헬퍼는 string literal로 dynamic import (turbopack 정적 분석 친화적)
    const fsHelper = await import('./logger-fs');

    const promptHash = fsHelper.hashPrompt(data.prompt);

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      caller: data.options.context || 'unknown',
      source: data.result?.source || 'failed',
      model: data.result?.model || data.options.model || 'unknown',
      durationMs: data.result?.durationMs || 0,
      promptHash,
      promptLength: data.prompt.length,
      outputLength: data.result?.output.length || 0,
      inputTokens: data.result?.inputTokens,
      outputTokens: data.result?.outputTokens,
      context: data.options.context,
      ...(LOG_FULL && {
        systemPrompt: data.options.systemPrompt,
        prompt: data.prompt,
        output: data.result?.output,
      }),
      ...(data.error && { error: data.error.message }),
    };

    await fsHelper.appendLog(entry.caller, JSON.stringify(entry));
  } catch {
    // 로깅 실패는 무시
  }
}

/**
 * 오늘의 로그 조회
 */
export async function getTodayLogs(caller?: string): Promise<LogEntry[]> {
  if (SKIP_LOGGING) return [];

  try {
    const fsHelper = await import('./logger-fs');
    const lines = await fsHelper.readTodayLogs(caller);

    const entries: LogEntry[] = [];
    for (const line of lines) {
      try {
        entries.push(JSON.parse(line) as LogEntry);
      } catch {
        /* skip */
      }
    }
    return entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  } catch {
    return [];
  }
}

/**
 * 로그 통계
 */
export async function getLogStats(): Promise<{
  totalCalls: number;
  byCaller: Record<string, number>;
  bySource: Record<string, number>;
  totalDurationMs: number;
  avgDurationMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}> {
  const logs = await getTodayLogs();
  const byCaller: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  let totalDurationMs = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const log of logs) {
    byCaller[log.caller] = (byCaller[log.caller] || 0) + 1;
    bySource[log.source] = (bySource[log.source] || 0) + 1;
    totalDurationMs += log.durationMs;
    totalInputTokens += log.inputTokens || 0;
    totalOutputTokens += log.outputTokens || 0;
  }

  return {
    totalCalls: logs.length,
    byCaller,
    bySource,
    totalDurationMs,
    avgDurationMs: logs.length > 0 ? totalDurationMs / logs.length : 0,
    totalInputTokens,
    totalOutputTokens,
  };
}

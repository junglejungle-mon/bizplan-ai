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
 * 변경 이력 (Round 2 정리):
 * - 죽은 import 제거 + Node fs 모듈 정적 import로 turbopack 동적 패턴 경고 제거
 * - SKIP_LOGGING 가드로 Vercel/브라우저에서는 절대 실행되지 않음
 */
import * as nodeFs from 'node:fs/promises';
import * as nodePath from 'node:path';
import * as nodeCrypto from 'node:crypto';
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

// 고정 로그 디렉토리 베이스
const LOG_BASE_DIR = 'data/ai-logs';

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
    const promptHash = nodeCrypto
      .createHash('sha256')
      .update(data.prompt)
      .digest('hex')
      .slice(0, 16);

    const today = new Date().toISOString().split('T')[0];
    const logDir = nodePath.join(process.cwd(), LOG_BASE_DIR, today);
    await nodeFs.mkdir(logDir, { recursive: true });

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

    // JSONL 형식으로 append (한 줄 = 한 호출)
    const logFile = nodePath.join(logDir, `${entry.caller}.jsonl`);
    await nodeFs.appendFile(logFile, JSON.stringify(entry) + '\n', 'utf-8');
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
    const today = new Date().toISOString().split('T')[0];
    const logDir = nodePath.join(process.cwd(), LOG_BASE_DIR, today);

    const files = await nodeFs.readdir(logDir);
    const targetFiles = caller ? files.filter((f) => f.startsWith(caller)) : files;

    const allEntries: LogEntry[] = [];
    for (const file of targetFiles) {
      const content = await nodeFs.readFile(nodePath.join(logDir, file), 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          allEntries.push(JSON.parse(line) as LogEntry);
        } catch {
          /* skip */
        }
      }
    }

    return allEntries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
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

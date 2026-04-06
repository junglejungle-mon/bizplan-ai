/**
 * AI 로거 — Node fs 헬퍼 (서버 전용)
 *
 * Turbopack 정적 분석 우회 전략:
 * - eval('require') 패턴으로 fs/path/crypto 모듈을 런타임에 로드
 *   (turbopack의 정적 import 트래커가 인식하지 못함)
 * - 이 파일은 logger.ts에서 SKIP_LOGGING 가드를 통과한 경우에만 dynamic import됨
 * - Vercel/브라우저에서는 절대 로드되지 않는다
 */

// turbopack 정적 분석을 완전히 우회하기 위해 eval로 require 가져오기
// (process.cwd() + path.join 패턴이 turbopack에서 동적 와일드카드로 인식되는 것 방지)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dynamicRequire: NodeRequire = (eval('require') as any);
const fsModule = dynamicRequire('node:fs') as typeof import('node:fs');
const pathModule = dynamicRequire('node:path') as typeof import('node:path');
const cryptoModule = dynamicRequire('node:crypto') as typeof import('node:crypto');

const LOG_BASE_DIR = 'data/ai-logs';

/**
 * 프롬프트 SHA256 해시 (앞 16자)
 */
export function hashPrompt(prompt: string): string {
  return cryptoModule.createHash('sha256').update(prompt).digest('hex').slice(0, 16);
}

/**
 * 오늘 날짜 (YYYY-MM-DD)
 */
function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * 로그 디렉토리 보장 + 경로 반환
 */
function ensureLogDirSync(): string {
  const today = getTodayKey();
  const cwd = process.cwd();
  const logDir = pathModule.join(cwd, LOG_BASE_DIR, today);
  fsModule.mkdirSync(logDir, { recursive: true });
  return logDir;
}

/**
 * 로그 한 줄 append
 */
export async function appendLog(caller: string, jsonLine: string): Promise<void> {
  const logDir = ensureLogDirSync();
  const logFile = pathModule.join(logDir, `${caller}.jsonl`);
  fsModule.appendFileSync(logFile, jsonLine + '\n', 'utf-8');
}

/**
 * 오늘의 로그 줄 목록 (caller 필터 옵션)
 */
export async function readTodayLogs(caller?: string): Promise<string[]> {
  const today = getTodayKey();
  const cwd = process.cwd();
  const logDir = pathModule.join(cwd, LOG_BASE_DIR, today);

  try {
    if (!fsModule.existsSync(logDir)) return [];
    const files = fsModule.readdirSync(logDir);
    const targetFiles = caller ? files.filter((f) => f.startsWith(caller)) : files;

    const allLines: string[] = [];
    for (const file of targetFiles) {
      const content = fsModule.readFileSync(pathModule.join(logDir, file), 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      allLines.push(...lines);
    }
    return allLines;
  } catch {
    return [];
  }
}

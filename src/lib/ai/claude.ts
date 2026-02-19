import Anthropic from "@anthropic-ai/sdk";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

// ─── 모드 전환 ───────────────────────────────────────────
// AI_MODE=local → 로컬 프록시 (Claude Max 구독, 무료)
// AI_MODE=api   → Anthropic API 직접 호출 (유료, 기본값)
const isLocalMode = process.env.AI_MODE === "local";
const LOG_AI_CALLS = process.env.LOG_AI_CALLS === "true";

// 로컬 프록시용 클라이언트 (Claude Max)
const localClient = isLocalMode
  ? new Anthropic({
      apiKey: "local-proxy-no-key-needed",
      baseURL: process.env.CLAUDE_PROXY_URL || "http://localhost:3457",
    })
  : null;

// API용 클라이언트 (유료)
// 로컬 모드에서도 초기화되므로, 빈 키일 때 더미 키 사용 (실제 API 호출 시 에러 발생)
const apiClient = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "sk-ant-placeholder-not-set",
});

// 텍스트 요청용 클라이언트 (모드에 따라 전환)
const anthropicClient = isLocalMode ? localClient! : apiClient;

// Vision/OCR: 로컬 모드에서도 프록시 사용 (이미지는 텍스트로 변환됨, CLI가 분석)
const anthropicVision = isLocalMode ? localClient! : apiClient;

// ─── 타입 정의 ───────────────────────────────────────────
export type ClaudeModel =
  | "claude-haiku-4-5-20251001"
  | "claude-sonnet-4-20250514"
  | "claude-opus-4-20250514";

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

// ─── 재시도 헬퍼 (Exponential Backoff) ────────────────────
async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; baseDelayMs?: number; caller?: string } = {}
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 1000, caller = "unknown" } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const isRetryable =
        error?.status === 429 || // Rate limit
        error?.status === 500 || // Server error
        error?.status === 502 ||
        error?.status === 503 ||
        error?.status === 529 || // Anthropic overloaded
        error?.error?.type === "overloaded_error" ||
        error?.message?.includes("ECONNRESET") ||
        error?.message?.includes("ETIMEDOUT");

      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }

      const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500;
      console.warn(
        `[AI Retry] ${caller} attempt ${attempt + 1}/${maxRetries} failed (${error?.status || error?.message}), retrying in ${Math.round(delay)}ms`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error("Unreachable");
}

// ─── AI 로그 저장 ─────────────────────────────────────────
async function logAICall(data: {
  caller: string;
  model: string;
  system?: string;
  messages: any[];
  response: string;
  durationMs: number;
}) {
  if (!LOG_AI_CALLS) return;

  try {
    const today = new Date().toISOString().split("T")[0];
    const logDir = join(process.cwd(), "data", "ai-logs", today);
    await mkdir(logDir, { recursive: true });

    const filename = `${data.caller}-${Date.now()}.json`;
    const logEntry = {
      timestamp: new Date().toISOString(),
      mode: isLocalMode ? "local" : "api",
      ...data,
    };

    await writeFile(join(logDir, filename), JSON.stringify(logEntry, null, 2));
  } catch {
    // 로깅 실패는 무시 (메인 로직에 영향 없음)
  }
}

// ─── callClaude (비스트리밍) ──────────────────────────────
export async function callClaude({
  model = "claude-sonnet-4-20250514",
  system,
  messages,
  maxTokens = 4096,
  temperature = 0.7,
}: {
  model?: ClaudeModel;
  system?: string;
  messages: ClaudeMessage[];
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  const startTime = Date.now();

  const response = await withRetry(
    () =>
      anthropicClient.messages.create({
        model,
        max_tokens: maxTokens,
        ...(system && { system }),
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature,
      }),
    { caller: "callClaude" }
  );

  const textBlock = response.content.find((block) => block.type === "text");
  const result = textBlock?.text ?? "";

  // 비동기 로깅
  logAICall({
    caller: "callClaude",
    model,
    system,
    messages,
    response: result,
    durationMs: Date.now() - startTime,
  });

  return result;
}

// ─── streamClaude (스트리밍) ─────────────────────────────
export async function* streamClaude({
  model = "claude-sonnet-4-20250514",
  system,
  messages,
  maxTokens = 4096,
  temperature = 0.7,
}: {
  model?: ClaudeModel;
  system?: string;
  messages: ClaudeMessage[];
  maxTokens?: number;
  temperature?: number;
}): AsyncGenerator<string> {
  const startTime = Date.now();
  let fullResponse = "";

  const stream = await withRetry(
    async () =>
      anthropicClient.messages.stream({
        model,
        max_tokens: maxTokens,
        ...(system && { system }),
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature,
      }),
    { caller: "streamClaude" }
  );

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      fullResponse += event.delta.text;
      yield event.delta.text;
    }
  }

  // 비동기 로깅
  logAICall({
    caller: "streamClaude",
    model,
    system,
    messages,
    response: fullResponse,
    durationMs: Date.now() - startTime,
  });
}

// ─── callClaudeVision (Vision/OCR 전용) ──
// 로컬 모드: 이미지→텍스트 변환 후 프록시 호출 (CLI는 이미지 미지원)
// API 모드: Anthropic Vision API 직접 호출
export async function callClaudeVision({
  model = "claude-sonnet-4-20250514",
  system,
  messages,
  maxTokens = 4096,
  temperature = 0.7,
}: {
  model?: ClaudeModel;
  system?: string;
  messages: Anthropic.MessageCreateParamsNonStreaming["messages"];
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  const startTime = Date.now();

  // 로컬 모드에서는 이미지를 텍스트로 변환하여 프록시에 전달
  let processedMessages = messages;
  if (isLocalMode) {
    processedMessages = messages.map((m) => {
      if (typeof m.content === "string") return m;
      if (Array.isArray(m.content)) {
        // 이미지 블록을 텍스트로 변환
        const textParts = m.content.map((block: any) => {
          if (block.type === "text") return block.text;
          if (block.type === "image") {
            return "[이미지/문서 파일이 첨부되었습니다. 파일 내용을 직접 볼 수 없으므로, 주어진 텍스트 정보를 기반으로 최대한 분석해주세요.]";
          }
          return "";
        }).filter(Boolean);
        return { ...m, content: textParts.join("\n\n") };
      }
      return m;
    }) as typeof messages;
  }

  const response = await withRetry(
    () =>
      anthropicVision.messages.create({
        model,
        max_tokens: maxTokens,
        ...(system && { system }),
        messages: processedMessages,
        temperature,
      }),
    { caller: "callClaudeVision" }
  );

  const textBlock = response.content.find((block) => block.type === "text");
  const result = textBlock?.text ?? "";

  // 비동기 로깅
  logAICall({
    caller: "callClaudeVision",
    model,
    system,
    messages: messages.map((m) => ({
      role: m.role,
      content: typeof m.content === "string" ? m.content : "[vision/document content]",
    })),
    response: result,
    durationMs: Date.now() - startTime,
  });

  return result;
}

// ─── Exports ─────────────────────────────────────────────
// anthropic: 하위 호환성 (Vision/OCR에서 직접 사용하는 곳은 callClaudeVision으로 전환 권장)
export { apiClient as anthropic };

// 현재 모드 확인용
export const aiMode = isLocalMode ? "local" : "api";

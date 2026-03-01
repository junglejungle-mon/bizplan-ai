import Anthropic from "@anthropic-ai/sdk";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

// ─── Anthropic API 직접 호출 (프록시 제거) ───────────────
// 항상 Anthropic API를 직접 호출합니다 (Haiku = 저렴, 안정적)
const isLocalMode = false; // 프록시 모드 완전 제거
const LOG_AI_CALLS = process.env.LOG_AI_CALLS === "true";

const apiClient = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "sk-ant-placeholder-not-set",
});

// 모든 클라이언트를 API 직접 호출로 통일
const anthropicClient = apiClient;
const anthropicVision = apiClient;

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
    } catch (error: unknown) {
      const err = error as { status?: number; error?: { type?: string }; message?: string };
      const isRetryable =
        err?.status === 429 || // Rate limit
        err?.status === 500 || // Server error
        err?.status === 502 ||
        err?.status === 503 ||
        err?.status === 529 || // Anthropic overloaded
        err?.error?.type === "overloaded_error" ||
        err?.message?.includes("ECONNRESET") ||
        err?.message?.includes("ETIMEDOUT");

      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }

      const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500;
      console.warn(
        `[AI Retry] ${caller} attempt ${attempt + 1}/${maxRetries} failed (${err?.status || err?.message}), retrying in ${Math.round(delay)}ms`
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
  messages: { role: string; content: string }[];
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

  // 로컬 프록시 모드: system prompt를 첫 user 메시지에 병합
  // (프록시가 별도 system 필드를 긴 요청에서 무시하는 문제 workaround)
  const mergedMessages = isLocalMode && system
    ? messages.map((m, i) => ({
        ...m,
        content: i === 0 && m.role === "user"
          ? `[시스템 지시]\n${system}\n[/시스템 지시]\n\n${m.content}`
          : m.content,
      }))
    : messages;

  const response = await withRetry(
    () =>
      anthropicClient.messages.create({
        model,
        max_tokens: maxTokens,
        // API 모드에서만 별도 system 필드 사용 (Prompt Caching 포함)
        ...(!isLocalMode && system && {
          system: [
            {
              type: "text" as const,
              text: system,
              cache_control: { type: "ephemeral" as const },
            },
          ],
        }),
        messages: mergedMessages.map((m, i) => ({
          role: m.role,
          content: [
            {
              type: "text" as const,
              text: m.content,
              // 마지막 user 메시지에만 cache_control 적용 (Prompt Caching)
              ...(i === mergedMessages.length - 1 && m.role === "user"
                ? { cache_control: { type: "ephemeral" as const } }
                : {}),
            },
          ],
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

  // 로컬 프록시 모드: system prompt를 첫 user 메시지에 병합
  const streamMergedMessages = isLocalMode && system
    ? messages.map((m, i) => ({
        ...m,
        content: i === 0 && m.role === "user"
          ? `[시스템 지시]\n${system}\n[/시스템 지시]\n\n${m.content}`
          : m.content,
      }))
    : messages;

  const stream = await withRetry(
    async () =>
      anthropicClient.messages.stream({
        model,
        max_tokens: maxTokens,
        ...(!isLocalMode && system && {
          system: [
            {
              type: "text" as const,
              text: system,
              cache_control: { type: "ephemeral" as const },
            },
          ],
        }),
        messages: streamMergedMessages.map((m, i) => ({
          role: m.role,
          content: [
            {
              type: "text" as const,
              text: m.content,
              ...(i === streamMergedMessages.length - 1 && m.role === "user"
                ? { cache_control: { type: "ephemeral" as const } }
                : {}),
            },
          ],
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
        const textParts = m.content.map((block: { type: string; text?: string }) => {
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
        ...(system && {
          system: [
            {
              type: "text" as const,
              text: system,
              cache_control: { type: "ephemeral" as const },
            },
          ],
        }),
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
export const aiMode = "api";

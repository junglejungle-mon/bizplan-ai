import Anthropic from "@anthropic-ai/sdk";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

// ─── AI Provider 설정 ───────────────────────────────────
// 사용자 대면 (인터뷰, 사업계획서): 항상 Anthropic API (품질 우선)
// 백그라운드 배치 (매칭): Ollama 로컬 모델 (무료)
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:14b";

const useOllama = true; // 기본: Ollama (무료). 사업계획서만 forceAPI=true로 Claude 사용
const isLocalMode = true;
const LOG_AI_CALLS = process.env.LOG_AI_CALLS === "true";

const apiClient = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "sk-ant-placeholder-not-set",
});

// Anthropic 클라이언트 (Ollama 미사용 시 또는 Vision 전용)
const anthropicClient = apiClient;
const anthropicVision = apiClient;

// ─── Ollama 호출 (배치 매칭 전용, 무료) ─────────────────
export async function callOllama({
  system,
  messages,
  maxTokens = 4096,
  temperature = 0.7,
}: {
  system?: string;
  messages: { role: string; content: string }[];
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  const ollamaMessages: { role: string; content: string }[] = [];

  if (system) {
    ollamaMessages.push({ role: "system", content: system });
  }
  for (const m of messages) {
    ollamaMessages.push({ role: m.role, content: m.content });
  }

  const response = await fetch(`${OLLAMA_BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: ollamaMessages,
      max_tokens: maxTokens,
      temperature,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Ollama API error: ${response.status} — ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

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
  forceAPI = false,
}: {
  model?: ClaudeModel;
  system?: string;
  messages: ClaudeMessage[];
  maxTokens?: number;
  temperature?: number;
  forceAPI?: boolean;
}): Promise<string> {
  const startTime = Date.now();

  // ─── Ollama 모드 (기본 — 무료) ───
  if (useOllama && !forceAPI) {
    const result = await withRetry(
      () => callOllama({ system, messages, maxTokens, temperature }),
      { caller: "callClaude:ollama" }
    );

    logAICall({
      caller: "callClaude:ollama",
      model: OLLAMA_MODEL,
      system,
      messages,
      response: result,
      durationMs: Date.now() - startTime,
    });

    return result;
  }

  // ─── Anthropic API (사업계획서 등 forceAPI=true) ───
  const response = await withRetry(
    () =>
      anthropicClient.messages.create({
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
        messages: messages.map((m, i) => ({
          role: m.role,
          content: [
            {
              type: "text" as const,
              text: m.content,
              ...(i === messages.length - 1 && m.role === "user"
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
  forceAPI = false,
}: {
  model?: ClaudeModel;
  system?: string;
  messages: ClaudeMessage[];
  maxTokens?: number;
  temperature?: number;
  forceAPI?: boolean;
}): AsyncGenerator<string> {
  const startTime = Date.now();
  let fullResponse = "";

  // ─── Ollama 스트리밍 (기본 — 무료) ───
  if (useOllama && !forceAPI) {
    const ollamaMessages: { role: string; content: string }[] = [];
    if (system) ollamaMessages.push({ role: "system", content: system });
    for (const m of messages) ollamaMessages.push({ role: m.role, content: m.content });

    const response = await fetch(`${OLLAMA_BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: ollamaMessages,
        max_tokens: maxTokens,
        temperature,
        stream: true,
      }),
    });

    if (!response.ok || !response.body) {
      const errText = await response.text().catch(() => "");
      throw new Error(`Ollama stream error: ${response.status} — ${errText.slice(0, 200)}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
        try {
          const chunk = JSON.parse(line.slice(6));
          const text = chunk.choices?.[0]?.delta?.content;
          if (text) {
            fullResponse += text;
            yield text;
          }
        } catch { /* skip malformed chunks */ }
      }
    }

    logAICall({
      caller: "streamClaude:ollama",
      model: OLLAMA_MODEL,
      system,
      messages,
      response: fullResponse,
      durationMs: Date.now() - startTime,
    });
    return;
  }

  // ─── Anthropic API 스트리밍 (forceAPI=true) ───
  const stream = await withRetry(
    async () =>
      anthropicClient.messages.stream({
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
        messages: messages.map((m, i) => ({
          role: m.role,
          content: [
            {
              type: "text" as const,
              text: m.content,
              ...(i === messages.length - 1 && m.role === "user"
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
export const aiMode = useOllama ? "ollama" : "api";

// ─── 사업계획서 전용 Wrapper (항상 Anthropic API) ────────
export async function callClaudeAPI(opts: Parameters<typeof callClaude>[0]) {
  return callClaude({ ...opts, forceAPI: true });
}

export async function* streamClaudeAPI(opts: Parameters<typeof streamClaude>[0]) {
  yield* streamClaude({ ...opts, forceAPI: true });
}

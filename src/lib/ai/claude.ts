/**
 * claude.ts — AI Router 통합 (v2)
 *
 * 변경:
 * - 기존: Anthropic SDK + Ollama 직접 호출
 * - 신규: lib/ai/router.ts (Claude CLI → Gemini 폴백) 사용
 *
 * 함수 시그니처는 100% 유지 → 호출자 코드 변경 불필요
 *
 * Claude CLI 우선 (Max 무제한, 비용 0), 실패 시 Gemini (무료)
 * Vision도 Claude CLI 텍스트 폴백으로 위임 (Anthropic API 직접 호출 0건).
 *
 * 변경 이력:
 * - Round 5: logAICall fs 호출을 logger-fs 헬퍼로 위임
 * - 2026-04-07: Anthropic SDK client 인스턴스화 완전 제거 (타입만 유지)
 */
import type Anthropic from "@anthropic-ai/sdk";
import { callAI } from "./router";

const LOG_AI_CALLS = process.env.LOG_AI_CALLS === "true";

// ─── 타입 정의 ───────────────────────────────────────────
export type ClaudeModel =
  | "claude-haiku-4-5-20251001"
  | "claude-sonnet-4-20250514"
  | "claude-opus-4-20250514";

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

// 모델명 → router 모델 키 변환
function modelToKey(model: string): "haiku" | "sonnet" | "opus" {
  if (model.includes("haiku")) return "haiku";
  if (model.includes("opus")) return "opus";
  return "sonnet";
}

// messages 배열 → 단일 프롬프트 변환 (CLI는 messages 형식 미지원)
function messagesToPrompt(messages: ClaudeMessage[]): string {
  return messages
    .map((m) => {
      const prefix = m.role === "user" ? "User" : "Assistant";
      return `${prefix}: ${m.content}`;
    })
    .join("\n\n");
}

// ─── AI 로그 저장 (Round 5: logger-fs 헬퍼로 위임) ────────
async function logAICall(data: {
  caller: string;
  model: string;
  system?: string;
  messages: { role: string; content: string }[];
  response: string;
  durationMs: number;
  source?: string;
}) {
  if (!LOG_AI_CALLS || process.env.VERCEL) return;

  try {
    const fsHelper = await import('./logger-fs');
    const logEntry = {
      timestamp: new Date().toISOString(),
      ...data,
    };
    await fsHelper.appendLog(data.caller, JSON.stringify(logEntry));
  } catch {
    // 로깅 실패는 무시
  }
}

// ─── Ollama 호출 (하위 호환 — 이제는 router로 위임) ─────
export async function callOllama({
  system,
  messages,
}: {
  system?: string;
  messages: { role: string; content: string }[];
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  // router 사용 (Claude CLI → Gemini)
  const prompt = messagesToPrompt(messages as ClaudeMessage[]);
  const result = await callAI(prompt, {
    model: "haiku",
    systemPrompt: system,
    timeoutMs: 120_000,
    context: "callOllama-legacy",
  });
  return result.output;
}

// ─── callClaude (비스트리밍) ──────────────────────────────
export async function callClaude({
  model = "claude-sonnet-4-20250514",
  system,
  messages,
  forceAPI: _forceAPI = false,
}: {
  model?: ClaudeModel;
  system?: string;
  messages: ClaudeMessage[];
  maxTokens?: number;
  temperature?: number;
  forceAPI?: boolean;
}): Promise<string> {
  const startTime = Date.now();
  const prompt = messagesToPrompt(messages);
  const modelKey = modelToKey(model);

  const result = await callAI(prompt, {
    model: modelKey,
    systemPrompt: system,
    timeoutMs: 180_000,
    context: "callClaude",
  });

  logAICall({
    caller: "callClaude",
    model: result.model,
    source: result.source,
    system,
    messages,
    response: result.output,
    durationMs: Date.now() - startTime,
  });

  return result.output;
}

// ─── streamClaude (스트리밍) ─────────────────────────────
// 주의: Claude CLI는 스트리밍 미지원. 전체 응답을 받은 후 청크로 yield.
export async function* streamClaude({
  model = "claude-sonnet-4-20250514",
  system,
  messages,
  forceAPI: _forceAPI = false,
}: {
  model?: ClaudeModel;
  system?: string;
  messages: ClaudeMessage[];
  maxTokens?: number;
  temperature?: number;
  forceAPI?: boolean;
}): AsyncGenerator<string> {
  const startTime = Date.now();
  const prompt = messagesToPrompt(messages);
  const modelKey = modelToKey(model);

  const result = await callAI(prompt, {
    model: modelKey,
    systemPrompt: system,
    timeoutMs: 240_000,
    context: "streamClaude",
  });

  // 전체 응답을 청크로 분할 (50자씩)
  const chunkSize = 50;
  for (let i = 0; i < result.output.length; i += chunkSize) {
    yield result.output.slice(i, i + chunkSize);
  }

  logAICall({
    caller: "streamClaude",
    model: result.model,
    source: result.source,
    system,
    messages,
    response: result.output,
    durationMs: Date.now() - startTime,
  });
}

// ─── callClaudeVision (2026-04-07 완전 차단) ──
// Anthropic Vision API 직접 호출을 완전히 제거.
// 모든 호출은 Claude CLI(callClaude) 경로로 텍스트 폴백 처리됨 → 비용 0원.
//
// 부작용: 이미지/PDF의 시각 정보 손실 (텍스트 메타정보만 전달).
// OCR 품질이 필수면 별도 phase에서 Tesseract 등 도입 필요.
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
  console.warn(
    "[callClaudeVision] Anthropic Vision API 비활성 — Claude CLI 텍스트 폴백 사용"
  );
  const textMessages = messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content:
      typeof m.content === "string"
        ? m.content
        : "[이미지/문서 첨부됨 — 텍스트 정보로 대체]",
  }));
  return callClaude({ model, system, messages: textMessages, maxTokens, temperature });
}

// ─── Exports (하위 호환) ─────────────────────────────────
// Note: 2026-04-07 — Anthropic SDK client export 제거됨.
// 직접 호출 경로는 모두 router(callAI)로 통합되어 더 이상 SDK client 인스턴스가 필요 없음.

// 현재 모드 (router는 자동 폴백)
export const aiMode = "router";

// 사업계획서 전용 Wrapper (router가 자동으로 최선 선택)
export async function callClaudeAPI(opts: Parameters<typeof callClaude>[0]) {
  return callClaude(opts);
}

export async function* streamClaudeAPI(opts: Parameters<typeof streamClaude>[0]) {
  yield* streamClaude(opts);
}

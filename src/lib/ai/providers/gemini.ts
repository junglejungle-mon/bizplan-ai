/**
 * Gemini Provider — 무료 폴백
 * Google AI Studio API 사용 (gemini-2.0-flash, 무료 1500/day)
 *
 * https://ai.google.dev/gemini-api/docs/api-key
 */
import type { AIProvider, AICallOptions, AICallResult } from '../types';

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models';

// Gemini 모델 매핑 (Claude 모델명 → Gemini 모델명)
const MODEL_MAP: Record<string, string> = {
  haiku: 'gemini-2.5-flash', // 빠른 응답 (무료)
  sonnet: 'gemini-2.5-flash', // 기본 (무료)
  opus: 'gemini-2.5-pro', // 고품질 (무료 한도 적음)
};

class GeminiProvider implements AIProvider {
  readonly name = 'gemini' as const;

  private getApiKey(): string {
    const key =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GOOGLE_AI_API_KEY ||
      '';
    return key;
  }

  async isAvailable(): Promise<boolean> {
    return this.getApiKey().length > 0;
  }

  async call(prompt: string, options: AICallOptions = {}): Promise<AICallResult> {
    const start = Date.now();
    const apiKey = this.getApiKey();

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not set');
    }

    const modelKey = options.model ?? 'sonnet';
    const geminiModel = MODEL_MAP[modelKey] ?? 'gemini-2.0-flash-exp';
    const timeoutMs = options.timeoutMs ?? 120_000;

    const url = `${GEMINI_ENDPOINT}/${geminiModel}:generateContent?key=${apiKey}`;

    // 시스템 프롬프트는 첫 user message 앞에 합침
    const fullPrompt = options.systemPrompt
      ? `${options.systemPrompt}\n\n---\n\n${prompt}`
      : prompt;

    const body = {
      contents: [
        {
          role: 'user',
          parts: [{ text: fullPrompt }],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
        ...(options.jsonMode && { responseMimeType: 'application/json' }),
      },
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(
          `Gemini API error: ${res.status} ${errText.slice(0, 300)}`
        );
      }

      const data = (await res.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
        usageMetadata?: {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
        };
      };

      const output =
        data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

      if (!output) {
        throw new Error('Gemini returned empty response');
      }

      return {
        output: output.trim(),
        source: 'gemini',
        model: geminiModel,
        durationMs: Date.now() - start,
        inputTokens: data.usageMetadata?.promptTokenCount,
        outputTokens: data.usageMetadata?.candidatesTokenCount,
      };
    } catch (e) {
      clearTimeout(timer);
      throw e;
    }
  }
}

export const geminiProvider = new GeminiProvider();

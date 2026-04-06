/**
 * AI Router 공통 타입
 */

export type AIModel = 'haiku' | 'sonnet' | 'opus';
export type AISource = 'claude-cli' | 'gemini' | 'unavailable';

export interface AICallOptions {
  /** 모델 선택 (CLI는 무시될 수 있음, 정보용) */
  model?: AIModel;
  /** 시스템 프롬프트 */
  systemPrompt?: string;
  /** 타임아웃 ms (기본 120초) */
  timeoutMs?: number;
  /** JSON 응답 강제 */
  jsonMode?: boolean;
  /** 호출 컨텍스트 (로그용) */
  context?: string;
}

export interface AICallResult {
  /** AI 응답 텍스트 */
  output: string;
  /** 어디서 응답했는지 */
  source: AISource;
  /** 사용된 모델명 */
  model: string;
  /** 소요 시간 ms */
  durationMs: number;
  /** 입력 토큰 수 (추정) */
  inputTokens?: number;
  /** 출력 토큰 수 (추정) */
  outputTokens?: number;
}

export interface AIProvider {
  name: AISource;
  isAvailable(): Promise<boolean>;
  call(prompt: string, options?: AICallOptions): Promise<AICallResult>;
}

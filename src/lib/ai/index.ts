/**
 * AI Router — 통합 진입점
 *
 * 사용:
 *   import { callAI, callAIJson } from '@/lib/ai';
 *
 * 환경변수:
 *   - GEMINI_API_KEY (Gemini 폴백용)
 *   - AI_DEBUG=1 (디버그 로그)
 */
export { callAI, callAIJson, getAIStats, resetAIStats, healthCheck } from './router';
export type { AICallOptions, AICallResult, AIModel, AISource } from './types';

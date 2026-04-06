/**
 * 인터뷰 답변 → 사업계획서/IR 컨텍스트 주입 헬퍼
 *
 * 사용자가 /workflow/interview에서 채운 7개 답변을
 * plan-generator/ir-generator의 LLM 프롬프트에 자동으로 끼워넣는다.
 *
 * 사용:
 *   import { loadInterviewContext, formatInterviewForPrompt } from '@/lib/interview/context-injector';
 *   const ctx = await loadInterviewContext(supabase, companyId);
 *   const promptSection = formatInterviewForPrompt(ctx);
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  INTERVIEW_QUESTIONS,
  CATEGORY_LABELS,
  type InterviewAnswer,
  type InterviewCategory,
} from './question-bank';

export interface LoadedInterviewContext {
  /** 답변이 있으면 true */
  hasAnswers: boolean;
  /** 답변 목록 (순서대로) */
  answers: InterviewAnswer[];
  /** questionId -> answer 매핑 (빠른 조회용) */
  byId: Record<string, string>;
  /** category -> answer 매핑 */
  byCategory: Partial<Record<InterviewCategory, string>>;
}

/**
 * 회사 ID로 인터뷰 답변 로드
 *
 * 우선순위:
 * 1. company_interviews 테이블 (전용 테이블이 있으면)
 * 2. companies.metadata.interview_answers (폴백)
 */
export async function loadInterviewContext(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  companyId: string
): Promise<LoadedInterviewContext> {
  let answers: InterviewAnswer[] = [];

  // 1. 전용 테이블 시도
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('company_interviews')
      .select('answers')
      .eq('company_id', companyId)
      .maybeSingle();

    if (data?.answers && Array.isArray(data.answers)) {
      answers = data.answers as InterviewAnswer[];
    }
  } catch {
    // 테이블 없음 → 폴백
  }

  // 2. metadata 폴백
  if (answers.length === 0) {
    try {
      const { data: company } = await supabase
        .from('companies')
        .select('metadata')
        .eq('id', companyId)
        .maybeSingle();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const meta = (company?.metadata as any) || {};
      if (meta.interview_answers && Array.isArray(meta.interview_answers)) {
        answers = meta.interview_answers as InterviewAnswer[];
      }
    } catch {
      // 무시
    }
  }

  // 3. 인덱스 빌드
  const byId: Record<string, string> = {};
  const byCategory: Partial<Record<InterviewCategory, string>> = {};

  for (const a of answers) {
    if (a.questionId && a.answer) {
      byId[a.questionId] = a.answer;
    }
    if (a.category && a.answer) {
      // 같은 카테고리에 여러 답변 있으면 가장 긴 것 선택
      const existing = byCategory[a.category];
      if (!existing || a.answer.length > existing.length) {
        byCategory[a.category] = a.answer;
      }
    }
  }

  return {
    hasAnswers: answers.length > 0,
    answers,
    byId,
    byCategory,
  };
}

/**
 * 인터뷰 답변을 LLM 프롬프트용 텍스트로 포맷
 *
 * plan-generator나 ir-generator가 자신의 시스템 프롬프트에 다음 형식으로 끼워넣을 수 있다:
 *
 *   [회사 인터뷰 답변 — 사용자가 직접 입력]
 *   ## 회사 소개
 *   우리는 ...
 *
 *   ## 문제 인식
 *   국내 ...
 */
export function formatInterviewForPrompt(ctx: LoadedInterviewContext): string {
  if (!ctx.hasAnswers) {
    return '(인터뷰 답변 없음 — 자료에서만 추론)';
  }

  const lines: string[] = ['[회사 인터뷰 답변 — 사용자가 직접 입력한 핵심 정보]'];

  for (const q of INTERVIEW_QUESTIONS) {
    const ans = ctx.byId[q.id];
    if (!ans || ans.trim().length === 0) continue;

    lines.push('');
    lines.push(`## ${CATEGORY_LABELS[q.category]} — ${q.question}`);
    lines.push(ans.trim());
  }

  return lines.join('\n');
}

/**
 * 짧은 형식 (토큰 절약 — 시스템 프롬프트에 끼울 때)
 */
export function formatInterviewCompact(ctx: LoadedInterviewContext): string {
  if (!ctx.hasAnswers) return '';

  const parts: string[] = [];
  for (const q of INTERVIEW_QUESTIONS) {
    const ans = ctx.byId[q.id];
    if (ans && ans.trim().length > 0) {
      parts.push(`[${CATEGORY_LABELS[q.category]}] ${ans.trim().slice(0, 300)}`);
    }
  }

  return parts.join('\n');
}

/**
 * 카테고리별 답변 가져오기 (편의 함수)
 */
export function getAnswerByCategory(
  ctx: LoadedInterviewContext,
  category: InterviewCategory
): string | null {
  return ctx.byCategory[category] || null;
}

/**
 * 인터뷰 답변 → 사업계획서 섹션 매핑
 *
 * plan-generator가 섹션을 생성할 때 인터뷰 답변을 시드로 활용 가능
 */
export function buildSectionSeeds(
  ctx: LoadedInterviewContext
): Record<string, string> {
  if (!ctx.hasAnswers) return {};

  return {
    company_summary: ctx.byCategory.company || '',
    problem: ctx.byCategory.problem || '',
    solution: ctx.byCategory.solution || '',
    market: ctx.byCategory.market || '',
    competition: ctx.byCategory.competition || '',
    business_model: ctx.byCategory.business_model || '',
    team: ctx.byCategory.team || '',
  };
}

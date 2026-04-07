/**
 * 인터뷰 답변 → 사업계획서/IR 컨텍스트 주입 헬퍼
 *
 * company_interviews 테이블의 "모든 행"을 가져와 사업계획서/IR 생성 LLM 프롬프트에
 * 통째로 주입한다. 두 시스템이 공존하기 때문:
 *
 *   A. Legacy onboarding (AI 컨설턴트와의 대화형 인터뷰) — production에서 사용 중
 *      · round 1~5, question 텍스트가 conversational (예: "안녕하세요, 대표님!..")
 *      · 한 회사당 15~21 row
 *
 *   B. Workflow 인터뷰 (7개 정형 질문) — /workflow/interview
 *      · question 텍스트가 INTERVIEW_QUESTIONS[i].question과 일치
 *
 * 둘 다 `question`/`answer`/`category` 컬럼에 동일하게 저장되므로,
 * 여기서는 **행의 출처를 구분하지 않고** question+answer 쌍을 그대로 프롬프트에 넣는다.
 * LLM이 알아서 구조화해서 사업계획서 섹션 생성에 활용한다.
 *
 * 이전 버전(INTERVIEW_QUESTIONS 텍스트 완전 매칭)은 legacy conversational 데이터와
 * 절대 매칭되지 않아 사실상 0개 답변만 돌려주는 버그가 있었다. 이 파일은 그 버그를
 * 해결하고 legacy 사용자도 인터뷰 컨텍스트의 혜택을 받게 한다.
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
  /** 답변 목록 (DB 저장 순서대로) — legacy + workflow 모두 포함 */
  answers: InterviewAnswer[];
  /** questionId → answer 매핑 (workflow 인터뷰 기준, legacy는 채워지지 않을 수 있음) */
  byId: Record<string, string>;
  /** InterviewCategory → answer 매핑 (workflow 기준) */
  byCategory: Partial<Record<InterviewCategory, string>>;
  /** DB 저장된 원시 question/answer/category 쌍 (legacy 포함 전체) — 프롬프트 주입용 */
  rawRows: Array<{
    question: string;
    answer: string;
    category: string;
    round: number;
    questionOrder: number;
  }>;
}

/**
 * 회사 ID로 company_interviews의 모든 행을 가져온다.
 * round 1~5 (legacy) + 99 (workflow) 모두 포함.
 */
export async function loadInterviewContext(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  companyId: string
): Promise<LoadedInterviewContext> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows: any[] = [];

  try {
    const { data } = await supabase
      .from('company_interviews')
      .select('question, answer, category, question_order, round, created_at')
      .eq('company_id', companyId)
      .order('round', { ascending: true })
      .order('question_order', { ascending: true });
    rows = data ?? [];
  } catch {
    // 테이블 없음 또는 RLS 거부 — 빈 배열 유지
  }

  // answer가 비어있는 row는 제외 (AI가 던진 질문만 저장되고 답변 없는 케이스)
  const valid = rows.filter(
    (r) => typeof r.answer === 'string' && r.answer.trim().length > 0
  );

  const rawRows = valid.map((r) => ({
    question: String(r.question ?? ''),
    answer: String(r.answer ?? ''),
    category: String(r.category ?? ''),
    round: Number(r.round ?? 0),
    questionOrder: Number(r.question_order ?? 0),
  }));

  // workflow 인터뷰(정형 7 질문)만 InterviewAnswer로 변환
  // (question 텍스트가 INTERVIEW_QUESTIONS와 정확 매칭될 때만)
  const questionToId = new Map(
    INTERVIEW_QUESTIONS.map((q) => [q.question, { id: q.id, category: q.category }])
  );
  const answers: InterviewAnswer[] = [];
  for (const r of valid) {
    const meta = questionToId.get(String(r.question ?? ''));
    if (!meta) continue;
    answers.push({
      questionId: meta.id,
      category: meta.category,
      answer: String(r.answer),
      source: 'user_input',
      length: String(r.answer).length,
      answeredAt: String(r.created_at ?? new Date().toISOString()),
    });
  }

  // 인덱스 빌드 (workflow 인터뷰 기준)
  const byId: Record<string, string> = {};
  const byCategory: Partial<Record<InterviewCategory, string>> = {};
  for (const a of answers) {
    byId[a.questionId] = a.answer;
    const existing = byCategory[a.category];
    if (!existing || a.answer.length > existing.length) {
      byCategory[a.category] = a.answer;
    }
  }

  return {
    hasAnswers: rawRows.length > 0,
    answers,
    byId,
    byCategory,
    rawRows,
  };
}

/**
 * 인터뷰 답변을 LLM 프롬프트용 텍스트로 포맷
 *
 * rawRows를 Q/A 쌍으로 그대로 넣는다. legacy conversational 데이터도 자연스럽게 포함됨.
 *
 * 형식:
 *   [회사 인터뷰 답변 — 사용자가 직접 입력한 핵심 정보 (N개)]
 *
 *   [1] Q: 회사를 소개해주세요
 *       A: 우리는 AI 기반 ...
 *
 *   [2] Q: 대표자 경력은?
 *       A: ○○대 컴퓨터공학 ...
 */
export function formatInterviewForPrompt(ctx: LoadedInterviewContext): string {
  if (!ctx.hasAnswers) {
    return '(인터뷰 답변 없음 — 자료에서만 추론)';
  }

  const lines: string[] = [
    `[회사 인터뷰 답변 — 사용자가 직접 입력한 핵심 정보 (${ctx.rawRows.length}개)]`,
  ];

  ctx.rawRows.forEach((r, idx) => {
    lines.push('');
    lines.push(`[${idx + 1}] Q: ${r.question.trim()}`);
    lines.push(`    A: ${r.answer.trim()}`);
  });

  return lines.join('\n');
}

/**
 * 짧은 형식 (토큰 절약 — 시스템 프롬프트에 끼울 때)
 * 각 답변을 300자로 잘라서 나열
 */
export function formatInterviewCompact(ctx: LoadedInterviewContext): string {
  if (!ctx.hasAnswers) return '';

  return ctx.rawRows
    .map((r) => {
      const cat = r.category || 'general';
      return `[${cat}] ${r.answer.trim().slice(0, 300)}`;
    })
    .join('\n');
}

/**
 * 카테고리별 답변 가져오기 (편의 함수 — workflow 인터뷰 기준)
 */
export function getAnswerByCategory(
  ctx: LoadedInterviewContext,
  category: InterviewCategory
): string | null {
  return ctx.byCategory[category] || null;
}

/**
 * 인터뷰 답변 → 사업계획서 섹션 매핑 (workflow 인터뷰 기준)
 *
 * 주의: legacy onboarding 데이터는 여기서 채워지지 않음 (category가 다름).
 * legacy 사용자는 formatInterviewForPrompt의 raw 덤프로 처리.
 */
export function buildSectionSeeds(
  ctx: LoadedInterviewContext
): Record<string, string> {
  if (ctx.answers.length === 0) return {};

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

// CATEGORY_LABELS는 기존 코드 호환용 export
export { CATEGORY_LABELS };

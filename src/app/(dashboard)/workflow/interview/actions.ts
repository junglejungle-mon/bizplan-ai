/**
 * AI 인터뷰 서버 액션
 *
 * - generateInterviewAnswers: 회사 자료를 보고 AI가 7개 답안 자동 생성
 * - saveInterviewAnswers: 답변을 DB에 저장 (company_interviews 테이블 또는 metadata)
 */
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { generateAutoAnswers } from '@/lib/interview/auto-answer';
import type { InterviewAnswer } from '@/lib/interview/question-bank';

// ============================================================================
// 1. AI 자동 답안 생성
// ============================================================================
export async function generateInterviewAnswers(): Promise<{
  ok: boolean;
  answers?: Record<string, string>;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: '로그인이 필요합니다' };

  // 회사 정보
  const { data: companies } = await supabase
    .from('companies')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(1);

  const company = companies?.[0];
  if (!company) return { ok: false, error: '회사 정보가 없습니다' };

  // 업로드된 문서
  const { data: documents } = await supabase
    .from('company_documents')
    .select('document_type, extracted_data')
    .eq('company_id', company.id)
    .eq('status', 'extracted')
    .limit(20);

  // AI 자동 생성
  try {
    const result = await generateAutoAnswers({
      company: {
        name: company.name,
        industry: company.industry || undefined,
        business_summary: company.business_summary || undefined,
        employee_count: company.employee_count || undefined,
        founded_year: company.founded_year || undefined,
      },
      documents: (documents || []).map((d) => ({
        document_type: d.document_type as string,
        extracted_data: (d.extracted_data as Record<string, unknown>) || null,
      })),
      verbose: false,
    });

    // {questionId: answer} 형식으로 변환
    const answers: Record<string, string> = {};
    for (const a of result.answers) {
      answers[a.questionId] = a.answer;
    }

    return { ok: true, answers };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : '자동 생성 실패',
    };
  }
}

// ============================================================================
// 2. 답변 저장
//
// company_interviews 스키마 (실제 DB, legacy onboarding과 공유):
//   id, company_id, question, answer, category, extracted_insights,
//   question_order, round, created_at
//
// 워크플로우 인터뷰는 legacy onboarding(round 1~5)과 충돌하지 않도록
// round=99 (WORKFLOW_ROUND) 별도 네임스페이스에 저장한다.
// → 기존 onboarding 사용자 데이터를 절대 건드리지 않는다.
// ============================================================================
const WORKFLOW_ROUND = 99;
export async function saveInterviewAnswers(
  answers: InterviewAnswer[]
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: '로그인이 필요합니다' };

  const { data: companies } = await supabase
    .from('companies')
    .select('id')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(1);

  const company = companies?.[0];
  if (!company) return { ok: false, error: '회사 정보가 없습니다' };

  // 질문 텍스트를 question-bank에서 가져오기 위해 import
  const { INTERVIEW_QUESTIONS } = await import('@/lib/interview/question-bank');
  const questionMap = new Map(
    INTERVIEW_QUESTIONS.map((q, idx) => [q.id, { question: q.question, order: idx }])
  );

  if (answers.length === 0) {
    return { ok: false, error: '저장할 답변이 없습니다' };
  }

  // workflow 카테고리 → DB 허용 enum 매핑
  // (DB의 company_interviews_category_check는 legacy onboarding 시스템 enum만 허용)
  // basic, business, team_evidence, optimization, strategy
  const categoryMap: Record<string, string> = {
    company: 'basic',
    team: 'team_evidence',
    problem: 'business',
    solution: 'business',
    market: 'strategy',
    competition: 'strategy',
    business_model: 'business',
    financials: 'optimization',
    roadmap: 'strategy',
  };

  // 1) 기존 round=1 row 전부 삭제
  const { error: delErr } = await supabase
    .from('company_interviews')
    .delete()
    .eq('company_id', company.id)
    .eq('round', WORKFLOW_ROUND);

  if (delErr) {
    return { ok: false, error: `기존 답변 정리 실패: ${delErr.message}` };
  }

  // 2) 새 row 7개 insert (질문별로 1행)
  const rows = answers.map((a) => {
    const meta = questionMap.get(a.questionId);
    return {
      company_id: company.id,
      question: meta?.question || a.questionId,
      answer: a.answer,
      category: categoryMap[a.category] || 'basic',
      question_order: meta?.order ?? 0,
      round: WORKFLOW_ROUND,
    };
  });

  const { error: insErr, data: insData } = await supabase
    .from('company_interviews')
    .insert(rows)
    .select();

  if (insErr) {
    return { ok: false, error: `저장 실패: ${insErr.message}` };
  }

  if (!insData || insData.length === 0) {
    return { ok: false, error: '저장 실패: 0 rows inserted (RLS 정책 의심)' };
  }

  revalidatePath('/workflow');
  revalidatePath('/workflow/interview');

  return { ok: true };
}

// ============================================================================
// 3. 기존 답변 로드 (페이지 진입 시)
//
// row-per-question 스키마에서 questionId를 복원하기 위해
// question-bank의 질문 텍스트와 매칭한다.
// ============================================================================
export async function loadInterviewAnswers(): Promise<Record<string, string>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};

  const { data: companies } = await supabase
    .from('companies')
    .select('id')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(1);

  const company = companies?.[0];
  if (!company) return {};

  const { data: rows } = await supabase
    .from('company_interviews')
    .select('question, answer, question_order')
    .eq('company_id', company.id)
    .eq('round', WORKFLOW_ROUND)
    .order('question_order', { ascending: true });

  if (!rows || rows.length === 0) return {};

  // question 텍스트로 questionId 역매핑
  const { INTERVIEW_QUESTIONS } = await import('@/lib/interview/question-bank');
  const questionToId = new Map(INTERVIEW_QUESTIONS.map((q) => [q.question, q.id]));

  const result: Record<string, string> = {};
  for (const row of rows) {
    if (!row.answer) continue;
    const qId = questionToId.get(row.question as string);
    if (qId) {
      result[qId] = row.answer as string;
    }
  }
  return result;
}

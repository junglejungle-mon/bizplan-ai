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
// ============================================================================
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

  // company_interviews 테이블에 저장 시도, 없으면 companies.metadata에 저장
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: upsertErr } = await (supabase as any)
      .from('company_interviews')
      .upsert(
        {
          company_id: company.id,
          answers,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'company_id' }
      );

    if (upsertErr) {
      // 테이블이 없거나 다른 오류면 companies 테이블의 metadata에 저장 폴백
      const { error: updateErr } = await supabase
        .from('companies')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({ metadata: { interview_answers: answers } as any })
        .eq('id', company.id);

      if (updateErr) {
        return { ok: false, error: `저장 실패: ${updateErr.message}` };
      }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '저장 실패' };
  }

  revalidatePath('/workflow');
  revalidatePath('/workflow/interview');

  return { ok: true };
}

// ============================================================================
// 3. 기존 답변 로드 (페이지 진입 시)
// ============================================================================
export async function loadInterviewAnswers(): Promise<Record<string, string>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};

  const { data: companies } = await supabase
    .from('companies')
    .select('id, metadata')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(1);

  const company = companies?.[0];
  if (!company) return {};

  // 1. company_interviews 테이블 시도
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: interviewRow } = await (supabase as any)
      .from('company_interviews')
      .select('answers')
      .eq('company_id', company.id)
      .maybeSingle();

    if (interviewRow?.answers) {
      const result: Record<string, string> = {};
      const list = interviewRow.answers as InterviewAnswer[];
      for (const a of list) {
        result[a.questionId] = a.answer;
      }
      return result;
    }
  } catch {
    // 테이블 없음 → 폴백
  }

  // 2. companies.metadata 폴백
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const meta = (company.metadata as any) || {};
  if (meta.interview_answers) {
    const result: Record<string, string> = {};
    const list = meta.interview_answers as InterviewAnswer[];
    for (const a of list) {
      result[a.questionId] = a.answer;
    }
    return result;
  }

  return {};
}

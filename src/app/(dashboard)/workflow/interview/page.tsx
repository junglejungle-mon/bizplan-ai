/**
 * /workflow/interview — AI 인터뷰 페이지
 *
 * 사용자 흐름:
 * 1. 회사 자료가 있으면 AI가 자동으로 7개 답변 생성 (서버에서 미리 호출)
 * 2. 사용자는 답변을 검토/편집
 * 3. 저장 시 워크플로우로 돌아가서 다음 단계 진행
 */
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { InterviewForm } from '@/components/interview/interview-form';
import {
  generateInterviewAnswers,
  saveInterviewAnswers,
  loadInterviewAnswers,
} from './actions';

export const metadata = {
  title: 'AI 인터뷰 — 사업계획서',
};

export default async function InterviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: companies } = await supabase
    .from('companies')
    .select('id, name')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(1);

  const company = companies?.[0];
  if (!company) redirect('/onboarding');

  // 기존 답변 로드 (있으면)
  const existingAnswers = await loadInterviewAnswers();

  return (
    <div className="container mx-auto px-4 py-6 md:py-10 max-w-4xl">
      <div className="mb-6">
        <Link
          href="/workflow"
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-blue-600"
        >
          <ArrowLeft className="w-4 h-4" />
          워크플로우로 돌아가기
        </Link>
      </div>

      <InterviewForm
        initialAnswers={existingAnswers}
        onSave={saveInterviewAnswers}
        onGenerateAI={async () => {
          'use server';
          const result = await generateInterviewAnswers();
          if (!result.ok) {
            throw new Error(result.error || '생성 실패');
          }
          return result.answers || {};
        }}
        nextPath="/workflow"
      />
    </div>
  );
}

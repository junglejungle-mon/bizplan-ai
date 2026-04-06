/**
 * /workflow — 사업계획서 작성 통합 워크플로우 페이지
 *
 * 사용자 시나리오 (a-z):
 * ① 회사 정보 입력
 * ② AI 인터뷰 (자료 업로드 + 질문 답변)  → /workflow/interview
 * ③ 프로그램 매칭 (점수 + 추천)
 * ④ 사업계획서 작성 (AI 자동 + 편집)
 * ⑤ 양식 채움 + PPT 출력  → /workflow/output
 *
 * 각 단계는 실제 DB 상태를 기반으로 자동 판정.
 */
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { WorkflowShell } from '@/components/workflow/workflow-shell';
import type {
  WorkflowStepInfo,
  WorkflowStepKey,
} from '@/components/workflow/workflow-stepper';
import type { StepCardProps } from '@/components/workflow/step-card';

export const metadata = {
  title: '워크플로우 — 사업계획서 작성',
  description: 'AI와 함께 a-z로 사업계획서를 완성하세요',
};

async function safeCount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  filter: { col: string; val: string }
): Promise<number> {
  try {
    const { count, error } = await supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from(table as any)
      .select('*', { count: 'exact', head: true })
      .eq(filter.col, filter.val);
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export default async function WorkflowPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: companies } = await supabase
    .from('companies')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(1);

  const company = companies?.[0];
  if (!company) redirect('/onboarding');

  const [
    { count: documentCount },
    interviewCount,
    { count: matchingCount },
    { data: topMatching },
    { count: planCount },
    { data: latestPlan },
    { count: irCount },
  ] = await Promise.all([
    supabase
      .from('company_documents')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', company.id),

    safeCount(supabase, 'company_interviews', { col: 'company_id', val: company.id }),

    supabase
      .from('matchings')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', company.id),

    supabase
      .from('matchings')
      .select('match_score, programs(title, institution)')
      .eq('company_id', company.id)
      .order('match_score', { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from('business_plans')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', company.id),

    supabase
      .from('business_plans')
      .select('id, title, status, updated_at')
      .eq('company_id', company.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from('ir_presentations')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', company.id),
  ]);

  const hasCompany = !!company.business_summary || !!company.industry;
  const hasDocuments = (documentCount ?? 0) > 0;
  const hasInterview = interviewCount > 0 || hasDocuments;
  const hasMatching = (matchingCount ?? 0) > 0;
  const hasPlan = (planCount ?? 0) > 0;
  const planCompleted = latestPlan?.status === 'completed';
  const hasIR = (irCount ?? 0) > 0;

  const stepStatuses: Record<WorkflowStepKey, WorkflowStepInfo['status']> = {
    company: hasCompany ? 'completed' : 'available',
    interview: !hasCompany ? 'locked' : hasInterview ? 'completed' : 'available',
    matching: !hasInterview
      ? 'locked'
      : hasMatching
        ? 'completed'
        : 'available',
    plan: !hasMatching
      ? 'locked'
      : planCompleted
        ? 'completed'
        : hasPlan
          ? 'in_progress'
          : 'available',
    output:
      !planCompleted && !hasPlan
        ? 'locked'
        : hasIR
          ? 'completed'
          : hasPlan
            ? 'available'
            : 'locked',
  };

  const steps: WorkflowStepInfo[] = [
    {
      key: 'company',
      number: 1,
      label: '회사 정보 입력',
      shortLabel: '회사 정보',
      description: '기본 정보 + 사업 요약',
      status: stepStatuses.company,
    },
    {
      key: 'interview',
      number: 2,
      label: 'AI 인터뷰 + 자료 업로드',
      shortLabel: 'AI 인터뷰',
      description: '7개 핵심 질문 자동 답안',
      status: stepStatuses.interview,
    },
    {
      key: 'matching',
      number: 3,
      label: '정부지원사업 매칭',
      shortLabel: '매칭',
      description: '내 사업에 맞는 프로그램 추천',
      status: stepStatuses.matching,
    },
    {
      key: 'plan',
      number: 4,
      label: '사업계획서 작성',
      shortLabel: '계획서',
      description: 'AI가 자동 작성, 편집 가능',
      status: stepStatuses.plan,
    },
    {
      key: 'output',
      number: 5,
      label: '양식 채움 + IR PPT',
      shortLabel: '결과물',
      description: 'HWPX 양식 + 고퀄리티 PPT',
      status: stepStatuses.output,
    },
  ];

  const topProgramTitle = topMatching?.programs
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((topMatching.programs as any).title as string) || ''
    : '';

  const cardProps: Record<WorkflowStepKey, Omit<StepCardProps, 'status' | 'number' | 'stepKey'>> = {
    company: {
      title: '회사 정보',
      description: '회사명, 업종, 사업 요약을 등록하세요',
      summary: hasCompany
        ? `${company.name} · ${company.industry || '업종 미설정'}`
        : undefined,
      metrics: hasCompany
        ? [
            { label: '회사명', value: company.name?.slice(0, 8) || '-' },
            { label: '업종', value: company.industry?.slice(0, 6) || '-' },
            { label: '직원', value: String(company.employee_count || '-') },
          ]
        : undefined,
      primaryAction: {
        label: hasCompany ? '회사 정보 편집' : '회사 정보 입력',
        href: '/company',
      },
    },
    interview: {
      title: 'AI 인터뷰 (7개 표준 질문)',
      description: 'AI가 자료를 보고 답안 자동 생성, 검토만 하세요',
      summary: hasDocuments
        ? `자료 ${documentCount}건 — AI가 자동 답안 생성 가능`
        : '자료 없이도 직접 답변 가능',
      metrics: hasDocuments
        ? [
            { label: '문서', value: String(documentCount), color: 'success' },
            { label: '질문', value: '7개' },
            { label: '소요', value: '~5분' },
          ]
        : [
            { label: '질문', value: '7개' },
            { label: '소요', value: '~10분' },
            { label: 'AI', value: '지원' },
          ],
      primaryAction: {
        label: hasInterview ? '인터뷰 편집' : 'AI 인터뷰 시작',
        href: '/workflow/interview',
      },
      secondaryAction: { label: '자료 업로드', href: '/documents' },
    },
    matching: {
      title: '정부지원사업 매칭',
      description: '내 사업에 가장 적합한 프로그램을 찾아드립니다',
      summary: hasMatching
        ? topProgramTitle
          ? `1위: ${topProgramTitle.slice(0, 25)}${topProgramTitle.length > 25 ? '...' : ''}`
          : `${matchingCount}건 매칭됨`
        : undefined,
      metrics: hasMatching
        ? [
            { label: '매칭', value: String(matchingCount), color: 'success' },
            {
              label: '최고 점수',
              value: topMatching?.match_score
                ? `${Math.round(topMatching.match_score)}점`
                : '-',
              color: 'success',
            },
            { label: '상태', value: '준비됨' },
          ]
        : undefined,
      primaryAction: {
        label: hasMatching ? '매칭 결과 보기' : '매칭 시작',
        href: '/programs',
      },
    },
    plan: {
      title: '사업계획서 작성',
      description: 'AI가 매칭된 프로그램에 맞춰 자동 작성합니다',
      summary: latestPlan ? `최신: ${latestPlan.title} (${latestPlan.status})` : undefined,
      metrics: hasPlan
        ? [
            { label: '계획서', value: String(planCount), color: 'success' },
            {
              label: '상태',
              value: planCompleted ? '완성' : '작성중',
              color: planCompleted ? 'success' : 'warning',
            },
            { label: '편집', value: '가능' },
          ]
        : undefined,
      primaryAction: {
        label: hasPlan ? '계획서 편집' : '계획서 작성',
        href: latestPlan ? `/plans/${latestPlan.id}` : '/plans',
      },
      secondaryAction: hasPlan ? { label: '목록 보기', href: '/plans' } : undefined,
    },
    output: {
      title: '양식 자동 채움 + IR PPT',
      description: 'HWPX 공고 양식을 채우고 고퀄리티 PPT를 생성합니다',
      summary: hasIR
        ? `IR ${irCount}건 생성됨 (하네스 v2 적용)`
        : hasPlan
          ? '계획서를 기반으로 PPT를 생성하세요'
          : undefined,
      metrics: hasIR
        ? [
            { label: 'IR', value: String(irCount), color: 'success' },
            { label: '품질', value: '80+', color: 'success' },
            { label: 'HWPX', value: '준비' },
          ]
        : undefined,
      primaryAction: {
        label: hasIR ? '결과물 보기' : '결과물 생성',
        href: '/workflow/output',
      },
      secondaryAction: hasPlan
        ? { label: '문서 다운로드', href: '/documents' }
        : undefined,
    },
  };

  return (
    <div className="container mx-auto px-4 py-6 md:py-10 max-w-6xl">
      <WorkflowShell
        companyName={company.name || '사용자'}
        steps={steps}
        cardProps={cardProps}
      />
    </div>
  );
}

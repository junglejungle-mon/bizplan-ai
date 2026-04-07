/**
 * /workflow/output — 양식 채움 + IR PPT 출력 통합 페이지
 *
 * 사용자가 사업계획서까지 완료한 후 진입.
 * 두 가지 출력을 한 화면에서 관리:
 * 1. HWPX 양식 자동 채움 (정부지원사업 신청용)
 * 2. IR PPT 생성 (하네스 v2로 80점+ 보장)
 */
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowLeft,
  FileText,
  Presentation,
  CheckCircle2,
  Sparkles,
  Download,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const metadata = {
  title: '양식 채움 + IR PPT — 사업계획서',
};

export default async function WorkflowOutputPage() {
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

  // 사업계획서 + IR 통계
  const [{ data: latestPlan }, { data: irList }, { count: docCount }] = await Promise.all([
    supabase
      .from('business_plans')
      .select('id, title, status, updated_at')
      .eq('company_id', company.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from('ir_presentations')
      .select('id, title, status, template, updated_at')
      .eq('company_id', company.id)
      .order('updated_at', { ascending: false })
      .limit(5),

    supabase
      .from('company_documents')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', company.id)
      .eq('document_type', 'application_form'),
  ]);

  const hasPlan = !!latestPlan;
  const irCount = irList?.length ?? 0;

  return (
    <div className="container mx-auto px-4 py-6 md:py-10 max-w-5xl">
      <div className="mb-6">
        <Link
          href="/workflow"
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-blue-600"
        >
          <ArrowLeft className="w-4 h-4" />
          워크플로우로 돌아가기
        </Link>
      </div>

      <div className="space-y-6">
        {/* 헤더 */}
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-blue-700 text-sm font-medium">
              <Sparkles className="w-4 h-4" />
              5단계: 결과물 출력
            </div>
            <h1 className="text-2xl font-bold mt-1 text-slate-900">
              양식 자동 채움 + IR PPT 생성
            </h1>
            <p className="text-sm text-slate-600 mt-2">
              완성된 사업계획서를 정부지원사업 양식에 자동으로 채우고, 평가위원에게 보여줄
              IR PPT를 생성합니다 (품질 80점+ 자동 보장)
            </p>
          </CardContent>
        </Card>

        {!hasPlan && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-4 text-amber-800 text-sm">
              ⚠️ 사업계획서가 없습니다. 먼저 사업계획서를 작성해주세요.{' '}
              <Link href="/workflow" className="underline font-medium">
                워크플로우로 이동
              </Link>
            </CardContent>
          </Card>
        )}

        {/* 두 카드 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* HWPX 양식 채움 */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
                    <FileText className="w-6 h-6 text-blue-600" />
                  </div>
                  <CardTitle>HWPX 양식 자동 채움</CardTitle>
                  <CardDescription className="mt-1">
                    정부지원사업 공고 양식에 사업계획서 내용을 자동으로 채워넣습니다
                  </CardDescription>
                </div>
                {(docCount ?? 0) > 0 && (
                  <Badge className="bg-green-100 text-green-700">{docCount}건</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm text-slate-700">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  스마트 채움 (필드 자동 매칭)
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  3단계 폴백 (실패 시 자동 재시도)
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  HWPX 원본 형식 그대로 유지
                </div>
              </div>
              <Link
                href="/documents"
                className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-md transition-colors"
              >
                양식 업로드 & 채우기 →
              </Link>
            </CardContent>
          </Card>

          {/* IR PPT 생성 */}
          <Card className="hover:shadow-lg transition-shadow border-indigo-200">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-3">
                    <Presentation className="w-6 h-6 text-indigo-600" />
                  </div>
                  <CardTitle>IR PPT 자동 생성</CardTitle>
                  <CardDescription className="mt-1">
                    하네스 v2가 품질 80점+를 자동 보장합니다
                  </CardDescription>
                </div>
                {irCount > 0 && (
                  <Badge className="bg-green-100 text-green-700">{irCount}건</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm text-slate-700">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  11개 패턴 라이브러리 자동 적용
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  Generator + Evaluator + Feedback 루프
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  최대 3라운드 자동 개선
                </div>
              </div>
              <Link
                href="/ir"
                className="block w-full text-center bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-md transition-colors"
              >
                IR PPT 생성하기 →
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* 최근 IR 목록 */}
        {irList && irList.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">최근 생성한 IR PPT</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {irList.map((ir) => (
                  <Link
                    key={ir.id as string}
                    href={`/ir`}
                    className="flex items-center justify-between p-3 rounded-md border hover:bg-slate-50 transition-colors"
                  >
                    <div>
                      <div className="font-medium text-sm">{ir.title as string}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {ir.template as string} ·{' '}
                        {new Date(ir.updated_at as string).toLocaleDateString('ko-KR')}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={
                          (ir.status as string) === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-amber-100 text-amber-700'
                        }
                      >
                        {ir.status as string}
                      </Badge>
                      <Download className="w-4 h-4 text-slate-400" />
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

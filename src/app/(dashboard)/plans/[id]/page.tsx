import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Presentation, Download, Sparkles } from "lucide-react";
import Link from "next/link";
import { PlanGeneratorButton } from "@/components/plans/plan-generator-button";
import { SectionCard } from "@/components/plans/section-card";
import { ExportButton } from "@/components/plans/export-button";

export default async function PlanEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: plan } = await supabase
    .from("business_plans")
    .select("*, programs(*)")
    .eq("id", id)
    .single();

  if (!plan) notFound();

  const { data: sections } = await supabase
    .from("plan_sections")
    .select("*")
    .eq("plan_id", id)
    .order("section_order");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/plans" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{plan.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge
                variant={
                  plan.status === "completed"
                    ? "success"
                    : plan.status === "generating"
                    ? "warning"
                    : "secondary"
                }
              >
                {plan.status === "completed"
                  ? "완성"
                  : plan.status === "generating"
                  ? "생성 중"
                  : "초안"}
              </Badge>
              {plan.programs?.title && (
                <span className="text-xs text-gray-500">
                  {plan.programs.title}
                </span>
              )}
              {plan.template_ocr_text && (
                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                  양식 OCR 적용
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/plans/${id}/ir`}>
            <Button size="sm" className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
              <Presentation className="h-4 w-4" /> IR PPT 생성
            </Button>
          </Link>
          <ExportButton planId={id} hasProgramForm={!!plan.program_id} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* 좌측: 섹션 목차 */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-500 px-3">목차</h3>
          {sections?.map((section: any, i: number) => (
            <a
              key={section.id}
              href={`#section-${section.id}`}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-gray-100 transition-colors"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-medium">
                {i + 1}
              </span>
              <span className="truncate">{section.section_name}</span>
            </a>
          ))}
        </div>

        {/* 중앙: 에디터 */}
        <div className="lg:col-span-2 space-y-6">
          {sections && sections.length > 0 ? (
            <>
              {/* 미완성 섹션이 있으면 이어쓰기 버튼 표시 */}
              {sections.some((s: any) => !s.content || s.content.length < 100) && (
                <Card className="border-blue-200 bg-blue-50">
                  <CardContent className="flex items-center justify-between py-4">
                    <div>
                      <p className="text-sm font-medium text-blue-900">
                        {sections.filter((s: any) => s.content && s.content.length >= 100).length}/{sections.length}개 섹션 완성
                      </p>
                      <p className="text-xs text-blue-700 mt-0.5">
                        이어쓰기를 클릭하면 미완성 섹션부터 이어서 생성합니다
                      </p>
                    </div>
                    <PlanGeneratorButton planId={id} hasContent={true} label="이어쓰기" />
                  </CardContent>
                </Card>
              )}
              {sections.map((section: any, i: number) => (
                <SectionCard
                  key={section.id}
                  planId={id}
                  section={section}
                  index={i}
                />
              ))}

            </>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center py-16">
                <p className="text-gray-500 mb-4">
                  아직 섹션이 생성되지 않았습니다
                </p>
                <PlanGeneratorButton planId={id} hasContent={false} />
              </CardContent>
            </Card>
          )}
        </div>

        {/* 우측: IR PPT + AI 어시스턴트 (sticky로 따라다님) */}
        <div className="hidden lg:block">
          <div className="sticky top-6 space-y-4">
            {/* IR PPT 생성 카드 */}
            <Card className="border-2 border-blue-400 bg-gradient-to-r from-blue-50 to-indigo-50">
              <CardContent className="py-5">
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-100">
                    <Presentation className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">IR PPT 자동 생성</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      사업계획서 기반 투자자용 PPT
                    </p>
                  </div>
                  <Link href={`/plans/${id}/ir`} className="w-full">
                    <Button className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                      <Sparkles className="h-4 w-4" /> PPT 만들기
                    </Button>
                  </Link>
                  <ExportButton planId={id} hasProgramForm={!!plan.program_id} />
                </div>
              </CardContent>
            </Card>

            {/* AI 어시스턴트 카드 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">AI 어시스턴트</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-500">
                <p>사업계획서 작성 중 궁금한 점을 물어보세요.</p>
                <div className="mt-4 space-y-2">
                  {[
                    "이 섹션 더 구체적으로",
                    "평가 기준 분석",
                    "리서치 추가",
                  ].map((tip, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      className="w-full text-xs justify-start"
                    >
                      {tip}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

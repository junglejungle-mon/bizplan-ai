import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Presentation } from "lucide-react";
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
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/plans/${id}/ir`}>
            <Button variant="outline" size="sm" className="gap-2">
              <Presentation className="h-4 w-4" /> IR PPT 생성
            </Button>
          </Link>
          <ExportButton planId={id} />
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
            sections.map((section: any, i: number) => (
              <SectionCard
                key={section.id}
                planId={id}
                section={section}
                index={i}
              />
            ))
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

        {/* 우측: AI 어시스턴트 */}
        <div>
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
  );
}

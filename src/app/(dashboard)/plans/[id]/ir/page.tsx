import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, Presentation } from "lucide-react";
import Link from "next/link";

export default async function IREditorPage({
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
    .select("*")
    .eq("id", id)
    .single();

  if (!plan) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/plans/${id}`}
            className="text-gray-400 hover:text-gray-600"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              IR PPT 편집기
            </h1>
            <p className="text-sm text-gray-500">{plan.title}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" /> PPTX 다운로드
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" /> PDF 다운로드
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center py-16">
          <Presentation className="h-16 w-16 text-gray-300 mb-4" />
          <h3 className="font-semibold text-gray-900">IR PPT 자동 생성</h3>
          <p className="mt-2 text-sm text-gray-500 text-center max-w-md">
            사업계획서를 기반으로 투자유치용 IR PPT를 자동 생성합니다. 표지,
            문제정의, 솔루션, 시장규모, 비즈니스모델, 팀소개 등 10~15장의
            슬라이드가 생성됩니다.
          </p>
          <div className="mt-6 flex gap-3">
            {["미니멀", "테크", "클래식"].map((template) => (
              <Badge
                key={template}
                variant="outline"
                className="cursor-pointer hover:bg-blue-50"
              >
                {template}
              </Badge>
            ))}
          </div>
          <Button className="mt-6 gap-2">
            <Presentation className="h-4 w-4" /> IR PPT 생성 시작
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreatePlanButton } from "@/components/programs/create-plan-button";
import {
  ArrowLeft,
  Calendar,
  Building2,
  ExternalLink,
  FileText,
  Star,
  MapPin,
} from "lucide-react";

export default async function ProgramDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: program } = await supabase
    .from("programs")
    .select("*")
    .eq("id", id)
    .single();

  if (!program) notFound();

  const { data: companies } = await supabase
    .from("companies")
    .select("id")
    .eq("user_id", user.id)
    .limit(1);

  const company = companies?.[0];

  let matching = null;
  if (company) {
    const { data } = await supabase
      .from("matchings")
      .select("*")
      .eq("company_id", company.id)
      .eq("program_id", id)
      .single();
    matching = data;
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-4">
        <Link href="/programs" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline">
              {program.source === "bizinfo"
                ? "기업마당"
                : program.source === "mss"
                ? "중소벤처"
                : "K-Startup"}
            </Badge>
            {matching && (
              <Badge variant="default">매칭점수 {matching.match_score}점</Badge>
            )}
          </div>
          <h1 className="text-xl font-bold text-gray-900">{program.title}</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 좌측: 상세 정보 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 공고 요약 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">공고 요약</CardTitle>
            </CardHeader>
            <CardContent>
              {program.summary ? (
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {program.summary}
                </p>
              ) : (
                <p className="text-sm text-gray-400 italic">요약 정보 없음</p>
              )}
            </CardContent>
          </Card>

          {/* 기본 정보 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">기본 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {program.institution && (
                <div className="flex items-center gap-3">
                  <Building2 className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">주관기관:</span>
                  <span className="text-sm font-medium">{program.institution}</span>
                </div>
              )}
              {program.target && (
                <div className="flex items-center gap-3">
                  <Star className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">지원대상:</span>
                  <span className="text-sm font-medium">{program.target}</span>
                </div>
              )}
              {(program.apply_start || program.apply_end) && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">신청기간:</span>
                  <span className="text-sm font-medium">
                    {program.apply_start &&
                      new Date(program.apply_start).toLocaleDateString("ko-KR")}
                    {program.apply_start && program.apply_end && " ~ "}
                    {program.apply_end &&
                      new Date(program.apply_end).toLocaleDateString("ko-KR")}
                  </span>
                </div>
              )}
              {program.hashtags && program.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {program.hashtags.map((tag: string, i: number) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 매칭 분석 */}
          {matching && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">AI 매칭 분석</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center h-16 w-16 rounded-full bg-blue-50 text-blue-700 font-bold text-xl">
                    {matching.match_score}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">적합성 점수</p>
                    <p className="text-sm text-gray-500">
                      {matching.match_score >= 80
                        ? "매우 적합"
                        : matching.match_score >= 60
                        ? "적합"
                        : matching.match_score >= 40
                        ? "보통"
                        : "낮음"}
                    </p>
                  </div>
                </div>
                {matching.match_reason && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-sm text-blue-800 whitespace-pre-wrap">
                      {matching.match_reason}
                    </p>
                  </div>
                )}
                {matching.deep_report && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs font-medium text-gray-500 mb-2">심층 분석</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {matching.deep_report}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* 우측: 액션 패널 */}
        <div className="space-y-4">
          {/* CTA: 사업계획서 자동 작성 */}
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="p-6 text-center">
              <FileText className="h-10 w-10 text-blue-600 mx-auto mb-3" />
              <h3 className="font-semibold text-blue-900">사업계획서 자동 작성</h3>
              <p className="mt-2 text-sm text-blue-700">
                이 사업에 맞는 사업계획서를 AI가 자동 작성합니다
              </p>
              <CreatePlanButton programId={program.id} programTitle={program.title} />
            </CardContent>
          </Card>

          {/* 원문 링크 */}
          {program.detail_url && (
            <Card>
              <CardContent className="p-4">
                <a
                  href={program.detail_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  원문 공고 보기
                </a>
              </CardContent>
            </Card>
          )}

          {/* 수집 정보 */}
          <Card>
            <CardContent className="p-4 text-xs text-gray-400">
              <p>수집일: {new Date(program.collected_at).toLocaleDateString("ko-KR")}</p>
              <p>출처: {program.source} / {program.source_id}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreatePlanButton } from "@/components/programs/create-plan-button";
import { GuidelineViewer } from "@/components/programs/guideline-viewer";
import {
  ArrowLeft,
  Calendar,
  Building2,
  ExternalLink,
  FileText,
  Star,
  Target,
  Zap,
  Shield,
  TrendingUp,
  Award,
  Sparkles,
} from "lucide-react";

type LucideIcon = typeof Target;
const BREAKDOWN_LABELS: Record<string, { label: string; max: number; icon: LucideIcon }> = {
  keyword_relevance: { label: "키워드 연관도", max: 30, icon: Target },
  direction_fit: { label: "사업방향 일치", max: 25, icon: TrendingUp },
  eligibility: { label: "자격요건 부합", max: 20, icon: Shield },
  necessity: { label: "필요성·활용도", max: 15, icon: Zap },
  competitiveness: { label: "선정 가능성", max: 10, icon: Award },
};

export default async function ProgramDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sample?: string; fit?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const sampleScore = sp.sample ? parseInt(sp.sample, 10) : null;
  const sampleFit = sp.fit || null;
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
    .order("updated_at", { ascending: false })
    .limit(1);

  const company = companies?.[0];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let matching: Record<string, any> | null = null;
  if (company) {
    const { data } = await supabase
      .from("matchings")
      .select("*")
      .eq("company_id", company.id)
      .eq("program_id", id)
      .single();
    matching = data;
  }

  const scoreBreakdown = matching?.score_breakdown || null;
  const matchKeywords: string[] = matching?.match_keywords || [];
  const fitLevel: string = matching?.fit_level || "";

  // 잘 쓰인 사업계획서 예시 가져오기
  let sampleSections: { section_name: string; content_preview: string; section_order: number }[] = [];
  const { data: samplePlanData } = await supabase
    .from("business_plans")
    .select("id, title")
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (samplePlanData) {
    const { data: fetchedSections } = await supabase
      .from("plan_sections")
      .select("section_name, content, section_order")
      .eq("plan_id", samplePlanData.id)
      .order("section_order");

    if (fetchedSections && fetchedSections.length > 0) {
      sampleSections = fetchedSections.map((s) => ({
        section_name: s.section_name,
        content_preview: s.content
          ? s.content.substring(0, 300) + (s.content.length > 300 ? "..." : "")
          : "",
        section_order: s.section_order,
      }));
    }
  }

  // DB에 없으면 하드코딩 예시
  if (sampleSections.length === 0) {
    sampleSections = [
      { section_order: 1, section_name: "사업 개요", content_preview: "본 사업은 반려동물 구강케어 전문기업으로서, 독자 개발한 '덴티소프트' 제품의 해외 시장 진출을 목표로 합니다. 국내 반려동물 시장이 연 10% 이상 성장하는 가운데, 글로벌 펫케어 시장은 2025년 기준 약 380조원 규모로 확대될 전망입니다." },
      { section_order: 2, section_name: "문제 인식 및 필요성", content_preview: "반려동물 구강 질환은 3세 이상 반려견의 80%가 겪는 가장 흔한 건강 문제입니다. 기존 구강케어 제품들은 화학 성분 기반으로 반려동물에게 부담이 되며, 보호자들의 불안감이 높은 상황입니다." },
      { section_order: 3, section_name: "제품·서비스 내용", content_preview: "덴티소프트는 천연 효소 기반 반려동물 구강케어 제품으로, 칫솔질 없이도 치석 제거와 구취 개선이 가능합니다. 특허 기술을 보유하고 있으며, 국내 동물병원 150곳에서 임상 검증을 완료했습니다." },
      { section_order: 4, section_name: "시장 분석 (TAM/SAM/SOM)", content_preview: "글로벌 펫 구강케어 시장(TAM)은 약 12조원, 당사 목표 시장인 아시아·태평양 지역(SAM)은 약 3.5조원, 초기 진출 가능 시장(SOM)은 일본·태국 중심 약 800억원으로 분석됩니다." },
      { section_order: 5, section_name: "사업 추진 전략", content_preview: "1단계: 일본 시장 진출 — 현지 파트너사 발굴 및 제품 인증 취득. 2단계: 태국·베트남 확장 — 현지 유통망 구축. 3단계: 미국 시장 테스트 — Amazon 입점 및 FDA 등록 준비." },
      { section_order: 6, section_name: "실현 가능성 및 기대 효과", content_preview: "당사는 국내 매출 30억원 달성 기업으로, 안정적인 수익 기반을 보유하고 있습니다. 수출바우처 지원을 통해 1년 내 해외 매출 5억원 달성이 가능합니다." },
    ];
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
            {fitLevel && (
              <Badge
                className={
                  fitLevel === "매우적합"
                    ? "bg-green-100 text-green-700"
                    : fitLevel === "적합"
                    ? "bg-blue-100 text-blue-700"
                    : fitLevel === "검토추천"
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-gray-100 text-gray-600"
                }
              >
                {fitLevel}
              </Badge>
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

          {/* AI 매칭 분석 (고도화) */}
          {matching ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">AI 매칭 분석</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* 점수 + 적합도 */}
                <div className="flex items-center gap-4">
                  <div className={`flex items-center justify-center h-16 w-16 rounded-full font-bold text-xl ${
                    matching.match_score >= 80
                      ? "bg-green-50 text-green-700"
                      : matching.match_score >= 60
                      ? "bg-blue-50 text-blue-700"
                      : matching.match_score >= 40
                      ? "bg-yellow-50 text-yellow-700"
                      : "bg-gray-50 text-gray-600"
                  }`}>
                    {matching.match_score}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">적합성 점수</p>
                    <p className="text-sm text-gray-500">
                      {fitLevel || (
                        matching.match_score >= 80
                          ? "매우 적합"
                          : matching.match_score >= 60
                          ? "적합"
                          : matching.match_score >= 40
                          ? "검토 추천"
                          : "참고"
                      )}
                    </p>
                  </div>
                </div>

                {/* 매칭 키워드 */}
                {matchKeywords.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">매칭 키워드</p>
                    <div className="flex flex-wrap gap-1.5">
                      {matchKeywords.map((kw, i) => (
                        <Badge key={i} className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs">
                          {kw}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* 다차원 점수 breakdown */}
                {scoreBreakdown && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-3">영역별 점수</p>
                    <div className="space-y-2.5">
                      {Object.entries(BREAKDOWN_LABELS).map(([key, config]) => {
                        const score = scoreBreakdown[key] || 0;
                        const percentage = Math.round((score / config.max) * 100);
                        const Icon = config.icon;
                        return (
                          <div key={key} className="flex items-center gap-3">
                            <Icon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-gray-600">{config.label}</span>
                                <span className="font-medium text-gray-900">{score}/{config.max}</span>
                              </div>
                              <div className="h-2 rounded-full bg-gray-100">
                                <div
                                  className={`h-2 rounded-full transition-all ${
                                    percentage >= 80
                                      ? "bg-green-500"
                                      : percentage >= 60
                                      ? "bg-blue-500"
                                      : percentage >= 40
                                      ? "bg-yellow-500"
                                      : "bg-gray-400"
                                  }`}
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 매칭 사유 (상세) */}
                {(matching.match_detail || matching.match_reason) && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-xs font-medium text-blue-700 mb-1">매칭 분석</p>
                    <p className="text-sm text-blue-800 whitespace-pre-wrap">
                      {matching.match_detail || matching.match_reason}
                    </p>
                  </div>
                )}

                {/* 심층 분석 보고서 */}
                {matching.deep_report && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-gray-600">심층 분석 보고서</p>
                      {matching.deep_score && (
                        <Badge variant="outline" className="text-xs">
                          심층점수 {matching.deep_score}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-gray-700 whitespace-pre-wrap prose prose-sm max-w-none">
                      {matching.deep_report}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (() => {
            /* 매칭 데이터 없을 때 — 예시 심층분석 미리보기 */
            const exScore = sampleScore ?? 85;
            const exFit = sampleFit ?? "매우적합";
            const ratio = exScore / 100;
            const exBreakdown = [
              { key: "keyword_relevance" as const, score: Math.round(30 * ratio) },
              { key: "direction_fit" as const, score: Math.round(25 * ratio) },
              { key: "eligibility" as const, score: Math.round(20 * ratio) },
              { key: "necessity" as const, score: Math.round(15 * ratio) },
              { key: "competitiveness" as const, score: Math.round(10 * ratio) },
            ];
            const exDeepScore = Math.round(exScore * 0.96);
            const scoreColor = exScore >= 80
              ? "bg-green-50 text-green-700"
              : exScore >= 60
              ? "bg-blue-50 text-blue-700"
              : exScore >= 40
              ? "bg-yellow-50 text-yellow-700"
              : "bg-gray-50 text-gray-600";
            return (
            <Card className="border-blue-200 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-bl-lg z-10">
                예시
              </div>
              <CardHeader>
                <CardTitle className="text-base">AI 매칭 분석</CardTitle>
                <p className="text-xs text-gray-500">인터뷰를 완료하면 아래와 같은 분석 결과를 받을 수 있습니다</p>
              </CardHeader>
              <CardContent className="space-y-5 opacity-80">
                {/* 예시 점수 */}
                <div className="flex items-center gap-4">
                  <div className={`flex items-center justify-center h-16 w-16 rounded-full font-bold text-xl ${scoreColor}`}>
                    {exScore}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">적합성 점수</p>
                    <p className="text-sm text-gray-500">{exFit}</p>
                  </div>
                </div>

                {/* 예시 매칭 키워드 */}
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">매칭 키워드</p>
                  <div className="flex flex-wrap gap-1.5">
                    {["반려동물", "수출바우처", "해외진출", "중소기업"].map((kw, i) => (
                      <Badge key={i} className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs">
                        {kw}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* 예시 영역별 점수 */}
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-3">영역별 점수</p>
                  <div className="space-y-2.5">
                    {exBreakdown.map((item) => {
                      const config = BREAKDOWN_LABELS[item.key];
                      const percentage = Math.round((item.score / config.max) * 100);
                      const Icon = config.icon;
                      return (
                        <div key={item.key} className="flex items-center gap-3">
                          <Icon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-gray-600">{config.label}</span>
                              <span className="font-medium text-gray-900">{item.score}/{config.max}</span>
                            </div>
                            <div className="h-2 rounded-full bg-gray-100">
                              <div
                                className={`h-2 rounded-full transition-all ${
                                  percentage >= 80 ? "bg-green-500" : percentage >= 60 ? "bg-blue-500" : percentage >= 40 ? "bg-yellow-500" : "bg-gray-400"
                                }`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 예시 매칭 분석 */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-xs font-medium text-blue-700 mb-1">매칭 분석</p>
                  <p className="text-sm text-blue-800">
                    귀사의 반려동물 헬스케어 사업 분야와 본 지원사업의 수출 지원 목적이 높은 연관성을 보입니다. 해외 시장 진출을 위한 바우처 지원으로 마케팅, 통번역, 해외 인증 등에 활용 가능합니다.
                  </p>
                </div>

                {/* 예시 심층 분석 보고서 */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-gray-600">심층 분석 보고서</p>
                    <Badge variant="outline" className="text-xs">심층점수 {exDeepScore}</Badge>
                  </div>
                  <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
{`■ 사업 적합성
본 지원사업은 중소기업의 해외 판로개척을 위한 수출바우처 지원으로, 귀사의 반려동물 헬스케어 제품 해외 수출 전략과 높은 시너지가 예상됩니다.

■ 강점 분석
- 반려동물 시장의 글로벌 성장세 (연 8.1% CAGR)
- 귀사의 독자 기술 (덴티소프트 특허) 보유
- 기존 국내 유통 채널 기반 안정적 매출

■ 활용 전략
바우처를 활용하여 일본·동남아 시장 진출을 위한 현지 마케팅, 제품 인증(FDA/CE), 현지 파트너 발굴에 집중 투자를 권장합니다.`}
                  </div>
                </div>
              </CardContent>

              {/* 인터뷰 CTA 오버레이 */}
              <div className="border-t border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-blue-900">내 기업에 맞는 분석을 받아보세요</p>
                    <p className="text-xs text-blue-600 mt-0.5">AI 인터뷰 3분이면 맞춤 매칭 분석이 완성됩니다</p>
                  </div>
                  <Link href="/company">
                    <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700">
                      <Sparkles className="h-3.5 w-3.5" />
                      인터뷰 시작
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
            );
          })()}
        </div>

        {/* 우측: 액션 패널 */}
        <div className="space-y-4">
          {/* 매칭 안 됐을 때 — AI 인터뷰 유도 (최상단) */}
          {!matching && (
            <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
              <CardContent className="p-6 text-center">
                <Sparkles className="h-10 w-10 text-amber-600 mx-auto mb-3" />
                <h3 className="font-semibold text-amber-900">무료 AI 인터뷰</h3>
                <p className="mt-2 text-sm text-amber-700">
                  3분 인터뷰만 하면 고퀄리티 사업계획서를 무료로 받을 수 있습니다
                </p>
                <ul className="mt-3 text-xs text-amber-600 space-y-1 text-left">
                  <li className="flex items-center gap-1.5">
                    <span className="text-amber-500">✓</span> AI 맞춤 매칭 분석 (5차원 점수)
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="text-amber-500">✓</span> 심층 분석 보고서 자동 생성
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="text-amber-500">✓</span> 사업계획서 자동 작성 (무료 1건)
                  </li>
                </ul>
                <Link href="/company">
                  <Button className="mt-4 w-full gap-1.5 bg-amber-600 hover:bg-amber-700">
                    <Sparkles className="h-4 w-4" />
                    AI 인터뷰 시작하기
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

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

          {/* 사업계획서 예시 미리보기 */}
          {sampleSections.length > 0 && (
            <Card className="border-purple-200 overflow-hidden">
              <CardContent className="p-0">
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 px-4 py-3 border-b border-purple-100">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-purple-600" />
                    <p className="text-sm font-semibold text-purple-900">이런 사업계획서가 만들어집니다</p>
                    <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 text-[10px]">
                      예시
                    </Badge>
                  </div>
                  <p className="text-xs text-purple-600 mt-0.5">{sampleSections.length}개 섹션 자동 작성 · DOCX/PDF 다운로드</p>
                </div>
                <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto">
                  {sampleSections.map((section) => (
                    <details key={section.section_order} className="group border border-gray-100 rounded-lg overflow-hidden">
                      <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors text-left">
                        <span className="flex h-5 w-5 items-center justify-center rounded bg-purple-100 text-[10px] font-bold text-purple-700 flex-shrink-0">
                          {section.section_order}
                        </span>
                        <span className="text-xs font-medium text-gray-700 flex-1">{section.section_name}</span>
                        <span className="text-[10px] text-gray-400 group-open:hidden">펼치기</span>
                      </summary>
                      <div className="px-3 pb-3 border-t border-gray-50">
                        <p className="text-xs text-gray-500 leading-relaxed mt-2 whitespace-pre-wrap">
                          {section.content_preview}
                        </p>
                      </div>
                    </details>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 공고 지침서 구조 분석 */}
          <GuidelineViewer
            programId={program.id}
            hasAttachment={!!(program as { attachment_urls?: unknown }).attachment_urls}
          />

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

          {/* 매칭 안 됐을 때 — 하단 인터뷰 리마인더 */}
          {!matching && (
            <Link href="/company">
              <Card className="border-blue-200 hover:shadow-md transition-shadow cursor-pointer bg-blue-50/50">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-blue-900">AI 인터뷰 → 무료 사업계획서</p>
                    <p className="text-xs text-blue-600">3분이면 맞춤 분석이 완성됩니다</p>
                  </div>
                  <ArrowLeft className="h-4 w-4 text-blue-400 rotate-180 flex-shrink-0" />
                </CardContent>
              </Card>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

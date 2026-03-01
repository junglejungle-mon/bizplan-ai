import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Building2,
  MapPin,
  Users,
  TrendingUp,
  FileText,
  ArrowLeft,
  CalendarDays,
  Banknote,
  ChevronRight,
  Sparkles,
  Plus,
  BarChart3,
} from "lucide-react";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!company) notFound();

  const [{ data: matchings }, { data: plans }] = await Promise.all([
    supabase
      .from("matchings")
      .select("*, programs(*)")
      .eq("company_id", id)
      .order("match_score", { ascending: false }),
    supabase
      .from("business_plans")
      .select("*")
      .eq("company_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const score: number = company.profile_score ?? 0;
  const scoreColor =
    score >= 70 ? "success" : score >= 30 ? "warning" : "destructive";

  return (
    <div className="space-y-6">
      {/* 뒤로가기 + 헤더 */}
      <div className="flex items-center gap-3">
        <Link href="/clients">
          <Button variant="outline" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            고객사 목록
          </Button>
        </Link>
      </div>

      {/* 회사명 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-50 p-3">
            <Building2 className="h-7 w-7 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{company.name}</h1>
            <p className="text-sm text-gray-500">
              {company.industry ?? "업종 미입력"}
              {company.region ? ` · ${company.region}` : ""}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Badge variant={scoreColor} className="text-sm px-3 py-1">
            프로필 {score}%
          </Badge>
        </div>
      </div>

      {/* CTA 버튼 */}
      <div className="flex flex-wrap gap-3">
        <Link href={`/programs?company_id=${company.id}`}>
          <Button className="gap-2">
            <Sparkles className="h-4 w-4" />
            매칭 실행
          </Button>
        </Link>
        <Link href={`/plans?company_id=${company.id}`}>
          <Button variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            계획서 생성
          </Button>
        </Link>
        <Link href={`/company`}>
          <Button variant="outline" className="gap-2">
            <Building2 className="h-4 w-4" />
            회사 정보 편집
          </Button>
        </Link>
      </div>

      {/* 진행 상태 요약 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* 프로필 완성도 */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">프로필 완성도</span>
            </div>
            <div className="flex items-end justify-between mb-2">
              <span
                className={`text-3xl font-bold ${
                  score >= 70
                    ? "text-green-600"
                    : score >= 30
                    ? "text-blue-600"
                    : "text-orange-500"
                }`}
              >
                {score}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-gray-100">
              <div
                className={`h-2 rounded-full transition-all ${
                  score >= 70
                    ? "bg-green-500"
                    : score >= 30
                    ? "bg-blue-500"
                    : "bg-orange-400"
                }`}
                style={{ width: `${score}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-gray-400">
              {score >= 70
                ? "고도화 완료"
                : score >= 30
                ? "인터뷰로 고도화 가능"
                : "기본 정보 입력 필요"}
            </p>
          </CardContent>
        </Card>

        {/* 매칭 수 */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-indigo-600" />
              <span className="text-sm font-medium text-gray-700">매칭 지원사업</span>
            </div>
            <p className="text-3xl font-bold text-indigo-600">
              {matchings?.length ?? 0}
              <span className="text-sm font-normal text-gray-400 ml-1">건</span>
            </p>
            <p className="mt-2 text-xs text-gray-400">
              {matchings && matchings.length > 0
                ? `최고 점수 ${matchings[0].match_score ?? 0}점`
                : "매칭 실행 필요"}
            </p>
          </CardContent>
        </Card>

        {/* 계획서 수 */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium text-gray-700">사업계획서</span>
            </div>
            <p className="text-3xl font-bold text-purple-600">
              {plans?.length ?? 0}
              <span className="text-sm font-normal text-gray-400 ml-1">건</span>
            </p>
            <p className="mt-2 text-xs text-gray-400">
              {plans && plans.length > 0
                ? `최근 ${new Date(plans[0].created_at).toLocaleDateString("ko-KR")}`
                : "계획서 없음"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 기본 정보 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-600" />
            기본 정보
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Building2,
                label: "업종",
                value: company.industry ?? "-",
                color: "text-blue-500",
              },
              {
                icon: MapPin,
                label: "지역",
                value: company.region ?? "-",
                color: "text-green-500",
              },
              {
                icon: Users,
                label: "직원 수",
                value: company.employee_count
                  ? `${company.employee_count}명`
                  : "-",
                color: "text-indigo-500",
              },
              {
                icon: Banknote,
                label: "연매출",
                value: company.revenue ?? "-",
                color: "text-emerald-500",
              },
              {
                icon: CalendarDays,
                label: "설립일",
                value: company.established_date
                  ? new Date(company.established_date).toLocaleDateString(
                      "ko-KR"
                    )
                  : "-",
                color: "text-orange-500",
              },
              {
                icon: BarChart3,
                label: "최근 업데이트",
                value: company.updated_at
                  ? new Date(company.updated_at).toLocaleDateString("ko-KR")
                  : "-",
                color: "text-gray-400",
              },
            ].map(({ icon: Icon, label, value, color }) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-lg bg-gray-50 px-4 py-3"
              >
                <Icon className={`h-4 w-4 shrink-0 ${color}`} />
                <div className="min-w-0">
                  <p className="text-xs text-gray-400">{label}</p>
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {value}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {company.business_content && (
            <div className="mt-4 rounded-lg bg-blue-50 p-4">
              <p className="text-xs font-medium text-blue-700 mb-2">
                AI 사업 프로필 요약
              </p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-4">
                {company.business_content}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 매칭 지원사업 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-indigo-600" />
              매칭 지원사업
              {matchings && matchings.length > 0 && (
                <Badge variant="secondary">{matchings.length}건</Badge>
              )}
            </CardTitle>
            <Link href={`/programs?company_id=${company.id}`}>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <Sparkles className="h-3.5 w-3.5" />
                매칭 실행
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {!matchings || matchings.length === 0 ? (
            <div className="py-8 text-center">
              <TrendingUp className="h-8 w-8 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">
                아직 매칭된 지원사업이 없습니다
              </p>
              <Link href={`/programs?company_id=${company.id}`}>
                <Button variant="outline" size="sm" className="mt-3 gap-1.5">
                  <Sparkles className="h-4 w-4" />
                  지금 매칭 실행하기
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {matchings.slice(0, 5).map(
                (m: {
                  id: string;
                  match_score: number | null;
                  programs: { id?: string; title?: string } | null;
                }) => (
                  <Link
                    key={m.id}
                    href={
                      m.programs?.id ? `/programs/${m.programs.id}` : "/programs"
                    }
                  >
                    <div className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="rounded-md bg-indigo-50 p-1.5 shrink-0">
                          <TrendingUp className="h-4 w-4 text-indigo-500" />
                        </div>
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {m.programs?.title ?? "지원사업명 없음"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="secondary" className="text-xs">
                          {m.match_score ?? 0}점
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </div>
                    </div>
                  </Link>
                )
              )}
              {matchings.length > 5 && (
                <Link href={`/programs?company_id=${company.id}`}>
                  <p className="text-center text-xs text-blue-500 hover:underline pt-2 cursor-pointer">
                    + {matchings.length - 5}건 더 보기
                  </p>
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 사업계획서 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-5 w-5 text-purple-600" />
              사업계획서
              {plans && plans.length > 0 && (
                <Badge variant="secondary">{plans.length}건</Badge>
              )}
            </CardTitle>
            <Link href={`/plans?company_id=${company.id}`}>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" />
                계획서 생성
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {!plans || plans.length === 0 ? (
            <div className="py-8 text-center">
              <FileText className="h-8 w-8 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">
                작성된 사업계획서가 없습니다
              </p>
              <Link href={`/plans?company_id=${company.id}`}>
                <Button variant="outline" size="sm" className="mt-3 gap-1.5">
                  <Plus className="h-4 w-4" />
                  계획서 작성하기
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {plans.map(
                (plan: {
                  id: string;
                  title: string;
                  status: string;
                  created_at: string;
                }) => {
                  const statusVariant =
                    plan.status === "completed"
                      ? "success"
                      : plan.status === "generating"
                      ? "warning"
                      : "secondary";
                  const statusLabel =
                    plan.status === "completed"
                      ? "완성"
                      : plan.status === "generating"
                      ? "생성 중"
                      : "초안";

                  return (
                    <Link key={plan.id} href={`/plans/${plan.id}`}>
                      <div className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="rounded-md bg-purple-50 p-1.5 shrink-0">
                            <FileText className="h-4 w-4 text-purple-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">
                              {plan.title}
                            </p>
                            <p className="text-xs text-gray-400">
                              {new Date(plan.created_at).toLocaleDateString(
                                "ko-KR"
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant={statusVariant} className="text-xs">
                            {statusLabel}
                          </Badge>
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        </div>
                      </div>
                    </Link>
                  );
                }
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  Building2,
  MapPin,
  TrendingUp,
  FileText,
  ChevronRight,
  Plus,
} from "lucide-react";

export default async function ClientsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: companies } = await supabase
    .from("companies")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  const stats = await Promise.all(
    (companies || []).map(async (c) => {
      const [{ count: matchCount }, { count: planCount }] = await Promise.all([
        supabase
          .from("matchings")
          .select("*", { count: "exact", head: true })
          .eq("company_id", c.id),
        supabase
          .from("business_plans")
          .select("*", { count: "exact", head: true })
          .eq("company_id", c.id),
      ]);
      return {
        companyId: c.id,
        matchCount: matchCount ?? 0,
        planCount: planCount ?? 0,
      };
    })
  );

  const statsMap = Object.fromEntries(
    stats.map((s) => [s.companyId, s])
  );

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">고객사 관리</h1>
          <p className="text-gray-500">
            컨설팅 중인 고객사를 클릭하여 상세 정보를 확인하세요
          </p>
        </div>
        <Link href="/onboarding">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            신규 고객사 추가
          </Button>
        </Link>
      </div>

      {/* 요약 통계 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-blue-50 p-2">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">전체 고객사</p>
              <p className="text-2xl font-bold text-gray-900">
                {companies?.length ?? 0}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-indigo-50 p-2">
              <TrendingUp className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">총 매칭 수</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.reduce((acc, s) => acc + s.matchCount, 0)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-purple-50 p-2">
              <FileText className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">총 계획서 수</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.reduce((acc, s) => acc + s.planCount, 0)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 고객사 목록 */}
      {!companies || companies.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center gap-4">
            <div className="rounded-full bg-gray-100 p-6">
              <Building2 className="h-10 w-10 text-gray-400" />
            </div>
            <div className="text-center">
              <p className="text-gray-700 font-medium">등록된 고객사가 없습니다</p>
              <p className="text-sm text-gray-500 mt-1">
                신규 고객사를 추가하여 컨설팅을 시작하세요
              </p>
            </div>
            <Link href="/onboarding">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                고객사 추가하기
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {companies.map((company) => {
            const s = statsMap[company.id] ?? {
              matchCount: 0,
              planCount: 0,
            };
            const score: number = company.profile_score ?? 0;
            const scoreColor =
              score >= 70
                ? "success"
                : score >= 30
                ? "warning"
                : "destructive";
            const updatedAt = company.updated_at
              ? new Date(company.updated_at).toLocaleDateString("ko-KR")
              : "-";

            return (
              <Link key={company.id} href={`/clients/${company.id}`}>
                <Card className="hover:shadow-md transition-all cursor-pointer border border-gray-200 hover:border-blue-300 h-full">
                  <CardContent className="p-5 space-y-4">
                    {/* 상단: 회사명 + 점수 뱃지 */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="rounded-lg bg-blue-50 p-2 shrink-0">
                          <Building2 className="h-5 w-5 text-blue-600" />
                        </div>
                        <h3 className="font-semibold text-gray-900 truncate">
                          {company.name}
                        </h3>
                      </div>
                      <Badge variant={scoreColor} className="shrink-0">
                        {score}%
                      </Badge>
                    </div>

                    {/* 업종 / 지역 */}
                    <div className="space-y-1.5">
                      {company.industry && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <TrendingUp className="h-3.5 w-3.5" />
                          {company.industry}
                        </div>
                      )}
                      {company.region && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <MapPin className="h-3.5 w-3.5" />
                          {company.region}
                        </div>
                      )}
                    </div>

                    {/* 프로필 점수 바 */}
                    <div>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>프로필 완성도</span>
                        <span className="font-medium">{score}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-100">
                        <div
                          className={`h-1.5 rounded-full transition-all ${
                            score >= 70
                              ? "bg-green-500"
                              : score >= 30
                              ? "bg-blue-500"
                              : "bg-orange-400"
                          }`}
                          style={{ width: `${score}%` }}
                        />
                      </div>
                    </div>

                    {/* 통계 */}
                    <div className="flex items-center justify-between text-xs text-gray-500 pt-1 border-t border-gray-100">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <TrendingUp className="h-3.5 w-3.5 text-indigo-400" />
                          매칭 {s.matchCount}건
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="h-3.5 w-3.5 text-purple-400" />
                          계획서 {s.planCount}건
                        </span>
                      </div>
                      <div className="flex items-center gap-0.5 text-blue-500">
                        상세보기
                        <ChevronRight className="h-3.5 w-3.5" />
                      </div>
                    </div>

                    {/* 최근 업데이트 */}
                    <p className="text-[10px] text-gray-400">
                      최근 업데이트: {updatedAt}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

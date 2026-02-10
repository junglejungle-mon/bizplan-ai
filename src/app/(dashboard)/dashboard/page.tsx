import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  FileText,
  FolderOpen,
  ArrowRight,
  TrendingUp,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { AssistantCard } from "@/components/assistant/assistant-card";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // 회사 정보 확인
  const { data: companies } = await supabase
    .from("companies")
    .select("*")
    .eq("user_id", user.id)
    .limit(1);

  const company = companies?.[0];

  // 온보딩 미완료 시 리다이렉트
  if (!company) {
    redirect("/onboarding");
  }

  // 통계 데이터
  const { count: matchCount } = await supabase
    .from("matchings")
    .select("*", { count: "exact", head: true })
    .eq("company_id", company.id);

  const { count: planCount } = await supabase
    .from("business_plans")
    .select("*", { count: "exact", head: true })
    .eq("company_id", company.id);

  const { count: docCount } = await supabase
    .from("company_documents")
    .select("*", { count: "exact", head: true })
    .eq("company_id", company.id);

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          안녕하세요, {company.name}
        </h1>
        <p className="mt-1 text-gray-500">
          오늘의 추천 지원사업과 진행 현황을 확인하세요
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "프로필 완성도",
            value: `${company.profile_score}%`,
            icon: TrendingUp,
            color: "text-blue-600",
            bg: "bg-blue-50",
          },
          {
            label: "매칭된 사업",
            value: `${matchCount ?? 0}건`,
            icon: Search,
            color: "text-green-600",
            bg: "bg-green-50",
          },
          {
            label: "사업계획서",
            value: `${planCount ?? 0}건`,
            icon: FileText,
            color: "text-purple-600",
            bg: "bg-purple-50",
          },
          {
            label: "연동 서류",
            value: `${docCount ?? 0}건`,
            icon: FolderOpen,
            color: "text-orange-600",
            bg: "bg-orange-50",
          },
        ].map((stat, i) => (
          <Card key={i}>
            <CardContent className="flex items-center gap-4 p-6">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.bg}`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-blue-600" />
              추천 지원사업
            </CardTitle>
          </CardHeader>
          <CardContent>
            {matchCount && matchCount > 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-500">
                  매칭된 {matchCount}건의 지원사업을 확인하세요
                </p>
                <Link href="/programs">
                  <Button className="gap-2">
                    지원사업 보기 <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-500">
                  아직 매칭된 지원사업이 없습니다.
                  프로필을 고도화하면 더 정확한 매칭을 받을 수 있습니다.
                </p>
                <Link href="/company">
                  <Button variant="outline" className="gap-2">
                    프로필 고도화 <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-orange-600" />
              데이터 연동 현황
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">연동 레벨</span>
                  <Badge variant="secondary">Level {Math.min(5, Math.floor((docCount ?? 0) / 2) + 1)}</Badge>
                </div>
                <div className="mt-2 h-2 rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-orange-400 to-orange-600 transition-all"
                    style={{ width: `${Math.min(100, ((docCount ?? 0) / 11) * 100)}%` }}
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">
                서류를 더 연동하면 사업계획서 품질이 향상됩니다
              </p>
              <Link href="/documents">
                <Button variant="outline" size="sm" className="gap-2">
                  서류 연동하기 <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI 사업 비서 */}
      <AssistantCard />

      {/* Profile Score */}
      {company.profile_score < 70 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="flex items-center justify-between p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-blue-900">프로필을 완성하세요</p>
                <p className="text-sm text-blue-700">
                  현재 {company.profile_score}% — 70% 이상이면 사업계획서 자동 작성이 가능합니다
                </p>
              </div>
            </div>
            <Link href="/company">
              <Button size="sm">AI 인터뷰 계속하기</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

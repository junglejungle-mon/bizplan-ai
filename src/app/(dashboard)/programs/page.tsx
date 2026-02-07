import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Calendar, MapPin, Building2, ArrowRight } from "lucide-react";

export default async function ProgramsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: companies } = await supabase
    .from("companies")
    .select("id")
    .eq("user_id", user.id)
    .limit(1);

  const company = companies?.[0];
  if (!company) redirect("/onboarding");

  // 매칭 결과가 있으면 매칭된 프로그램 우선, 없으면 전체
  const { data: matchings } = await supabase
    .from("matchings")
    .select("*, programs(*)")
    .eq("company_id", company.id)
    .order("match_score", { ascending: false });

  const { data: programs } = await supabase
    .from("programs")
    .select("*")
    .order("collected_at", { ascending: false })
    .limit(50);

  const matchedPrograms = matchings?.map((m: any) => ({
    ...m.programs,
    matchScore: m.match_score,
    matchReason: m.match_reason,
    matchingId: m.id,
  })) ?? [];

  const unmatchedPrograms = (programs ?? []).filter(
    (p: any) => !matchedPrograms.find((mp: any) => mp.id === p.id)
  );

  const allPrograms = [...matchedPrograms, ...unmatchedPrograms];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">지원사업</h1>
          <p className="text-gray-500">AI가 매칭한 정부지원사업 목록</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline">{matchedPrograms.length}건 매칭</Badge>
          <Badge variant="secondary">{allPrograms.length}건 전체</Badge>
        </div>
      </div>

      {/* 필터 영역 (Phase 2에서 상세 구현) */}
      <Card>
        <CardContent className="flex flex-wrap gap-3 p-4">
          <Button variant="outline" size="sm" className="gap-1">
            <MapPin className="h-3 w-3" /> 지역
          </Button>
          <Button variant="outline" size="sm" className="gap-1">
            <Building2 className="h-3 w-3" /> 분야
          </Button>
          <Button variant="outline" size="sm" className="gap-1">
            <Calendar className="h-3 w-3" /> 마감일
          </Button>
          <Button variant="outline" size="sm" className="gap-1">
            <Search className="h-3 w-3" /> 점수 범위
          </Button>
        </CardContent>
      </Card>

      {allPrograms.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {allPrograms.map((program: any) => (
            <Link key={program.id} href={`/programs/${program.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <Badge variant="outline" className="text-xs">
                      {program.source === "bizinfo" ? "기업마당" : program.source === "mss" ? "중소벤처" : "K-Startup"}
                    </Badge>
                    {program.matchScore && (
                      <div className="flex items-center justify-center h-10 w-10 rounded-full bg-blue-50 text-blue-700 font-bold text-sm">
                        {program.matchScore}
                      </div>
                    )}
                  </div>
                  <h3 className="font-semibold text-gray-900 line-clamp-2 mb-2">
                    {program.title}
                  </h3>
                  {program.summary && (
                    <p className="text-sm text-gray-500 line-clamp-2 mb-3">
                      {program.summary}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {program.hashtags?.slice(0, 3).map((tag: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>{program.institution}</span>
                    {program.apply_end && (
                      <span>
                        ~{new Date(program.apply_end).toLocaleDateString("ko-KR")}
                      </span>
                    )}
                  </div>
                  {program.matchReason && (
                    <p className="mt-3 text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2 line-clamp-2">
                      {program.matchReason}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Search className="h-12 w-12 text-gray-300 mb-4" />
            <h3 className="font-semibold text-gray-900">아직 수집된 지원사업이 없습니다</h3>
            <p className="mt-2 text-sm text-gray-500 text-center">
              정부지원사업 데이터를 수집하면 AI가 자동으로 매칭합니다.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SchedulerClient } from "@/components/scheduler/scheduler-client";

// Supabase join returns programs as array type, but runtime is single object
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SchedulerMatchingRow = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SchedulerProgramRow = Record<string, any>;

export default async function SchedulerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // 회사 정보
  const { data: companies } = await supabase
    .from("companies")
    .select("id")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1);

  const company = companies?.[0];
  if (!company) redirect("/onboarding");

  // 매칭된 지원사업 (마감일 기준 정렬)
  const { data: matchings } = await supabase
    .from("matchings")
    .select(
      `
      id,
      match_score,
      match_reason,
      fit_level,
      status,
      created_at,
      programs (
        id,
        title,
        institution,
        source,
        apply_start,
        apply_end,
        summary,
        target,
        hashtags,
        detail_url
      )
    `
    )
    .eq("company_id", company.id)
    .order("created_at", { ascending: false });

  // 전체 지원사업 (마감일이 있는 것만, 최근 + 향후)
  const today = new Date();
  const twoMonthsAgo = new Date(today);
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

  const { data: upcomingPrograms } = await supabase
    .from("programs")
    .select(
      "id, title, institution, source, apply_start, apply_end, hashtags"
    )
    .not("apply_end", "is", null)
    .gte("apply_end", twoMonthsAgo.toISOString().split("T")[0])
    .order("apply_end", { ascending: true })
    .limit(200);

  // 매칭된 program_id 세트
  const matchedProgramIds = new Set(
    (matchings || []).map((m: SchedulerMatchingRow) => m.programs?.id).filter(Boolean)
  );

  // 캘린더 이벤트 데이터로 변환
  const events = [
    // 매칭된 프로그램 (우선 표시)
    ...(matchings || [])
      .filter((m: SchedulerMatchingRow) => m.programs?.apply_end)
      .map((m: SchedulerMatchingRow) => ({
        id: m.id,
        programId: m.programs.id,
        title: m.programs.title,
        institution: m.programs.institution,
        source: m.programs.source,
        applyStart: m.programs.apply_start,
        applyEnd: m.programs.apply_end,
        hashtags: m.programs.hashtags || [],
        matchScore: m.match_score,
        fitLevel: m.fit_level,
        matchReason: m.match_reason,
        status: m.status || "matched",
        isMatched: true,
        detailUrl: m.programs.detail_url,
      })),
    // 미매칭 프로그램 (연한 색으로)
    ...(upcomingPrograms || [])
      .filter((p: SchedulerProgramRow) => !matchedProgramIds.has(p.id))
      .map((p: SchedulerProgramRow) => ({
        id: `prog-${p.id}`,
        programId: p.id,
        title: p.title,
        institution: p.institution,
        source: p.source,
        applyStart: p.apply_start,
        applyEnd: p.apply_end,
        hashtags: p.hashtags || [],
        matchScore: null,
        fitLevel: null,
        matchReason: null,
        status: "unmatched",
        isMatched: false,
        detailUrl: null,
      })),
  ];

  return <SchedulerClient events={events} />;
}

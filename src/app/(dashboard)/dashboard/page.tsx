import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

// Supabase join returns programs as array type, but runtime is single object
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MatchingRow = Record<string, any>;

type DocRow = { document_type: string; status: string };

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // 회사 정보 확인 (가장 최근 업데이트된 회사 우선)
  const { data: companies } = await supabase
    .from("companies")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1);

  const company = companies?.[0];
  if (!company) redirect("/onboarding");

  // 통계 데이터
  const [
    { count: matchCount },
    { count: planCount },
    { count: docCount },
    { count: programCount },
  ] = await Promise.all([
    supabase
      .from("matchings")
      .select("*", { count: "exact", head: true })
      .eq("company_id", company.id),
    supabase
      .from("business_plans")
      .select("*", { count: "exact", head: true })
      .eq("company_id", company.id),
    supabase
      .from("company_documents")
      .select("*", { count: "exact", head: true })
      .eq("company_id", company.id),
    supabase.from("programs").select("*", { count: "exact", head: true }),
  ]);

  // 마감 임박 매칭 사업 (7일 이내)
  const today = new Date();
  const sevenDaysLater = new Date(today);
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

  const { data: urgentMatchings } = await supabase
    .from("matchings")
    .select(
      `
      id,
      match_score,
      fit_level,
      programs (
        id,
        title,
        institution,
        source,
        apply_end,
        hashtags,
        detail_url
      )
    `
    )
    .eq("company_id", company.id)
    .order("created_at", { ascending: false });

  // 마감 임박 사업 필터링 + D-Day 계산
  const urgentPrograms = (urgentMatchings || [])
    .filter((m: MatchingRow) => {
      if (!m.programs?.apply_end) return false;
      const endDate = new Date(m.programs.apply_end);
      return endDate >= today && endDate <= sevenDaysLater;
    })
    .map((m: MatchingRow) => {
      const endDate = new Date(m.programs.apply_end);
      const dDay = Math.ceil(
        (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        id: m.programs.id,
        title: m.programs.title,
        institution: m.programs.institution,
        source: m.programs.source,
        applyEnd: m.programs.apply_end,
        matchScore: m.match_score,
        fitLevel: m.fit_level,
        dDay,
      };
    })
    .sort((a, b) => a.dDay - b.dDay);

  // 30일 이내 마감 사업 수
  const thirtyDaysLater = new Date(today);
  thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
  const deadlineSoonCount = (urgentMatchings || []).filter((m: MatchingRow) => {
    if (!m.programs?.apply_end) return false;
    const endDate = new Date(m.programs.apply_end);
    return endDate >= today && endDate <= thirtyDaysLater;
  }).length;

  // 서류 업로드 현황
  const { data: companyDocs } = await supabase
    .from("company_documents")
    .select("document_type, status")
    .eq("company_id", company.id);

  const extractedDocTypes = (companyDocs ?? [])
    .filter((d: DocRow) => d.status === "extracted")
    .map((d: DocRow) => d.document_type);

  // 최근 매칭 사업 Top 5 (점수 높은 순)
  const topMatchings = (urgentMatchings || [])
    .filter((m: MatchingRow) => m.programs?.apply_end)
    .map((m: MatchingRow) => {
      const endDate = new Date(m.programs.apply_end);
      const dDay = Math.ceil(
        (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        id: m.programs.id,
        title: m.programs.title,
        institution: m.programs.institution,
        source: m.programs.source,
        applyEnd: m.programs.apply_end,
        matchScore: m.match_score,
        fitLevel: m.fit_level,
        hashtags: m.programs.hashtags || [],
        dDay,
      };
    })
    .sort((a, b) => ((b.matchScore as number) || 0) - ((a.matchScore as number) || 0))
    .slice(0, 5);

  // 미션 생성 로직
  const missions: {
    id: string;
    type: "urgent" | "profile" | "document" | "plan" | "program";
    title: string;
    description: string;
    href: string;
    cta: string;
    priority: number;
  }[] = [];

  // 1) 마감 임박 사업 (최우선)
  if (urgentPrograms.length > 0) {
    const top = urgentPrograms[0];
    missions.push({
      id: "urgent-deadline",
      type: "urgent",
      title: `${top.title.length > 25 ? top.title.substring(0, 25) + "..." : top.title} 마감 확인`,
      description: `D-${top.dDay} 마감, 적합도 ${top.matchScore || "?"}점`,
      href: `/programs/${top.id}`,
      cta: "상세 보기",
      priority: 1,
    });
  }

  // 2) 프로필 미완성
  if (company.profile_score < 70) {
    const roundsNeeded = Math.ceil((70 - company.profile_score) / 15);
    missions.push({
      id: "profile-complete",
      type: "profile",
      title: "AI 인터뷰 계속하기",
      description: `${roundsNeeded}라운드만 더 하면 맞춤 계획서를 만들 수 있어요`,
      href: "/onboarding",
      cta: "시작하기",
      priority: 2,
    });
  }

  // 3) 서류 업로드
  if ((docCount ?? 0) < 3) {
    missions.push({
      id: "upload-docs",
      type: "document",
      title: "사업자등록증 업로드하기",
      description:
        (docCount ?? 0) === 0
          ? "AI가 회사정보를 자동 입력해요"
          : `서류 ${3 - (docCount ?? 0)}개만 더 올리면 IR PPT 무료`,
      href: "/documents",
      cta: "업로드",
      priority: 3,
    });
  }

  // 4) 사업계획서 작성
  if ((planCount ?? 0) === 0 && (matchCount ?? 0) > 0) {
    missions.push({
      id: "create-plan",
      type: "plan",
      title: "첫 사업계획서 만들기",
      description: `매칭된 ${matchCount}건 중 하나를 선택해서 AI가 자동 작성`,
      href: "/programs",
      cta: "시작하기",
      priority: 4,
    });
  }

  // 5) 지원사업 확인
  if ((matchCount ?? 0) > 0 && urgentPrograms.length === 0) {
    missions.push({
      id: "check-programs",
      type: "program",
      title: "새 매칭 지원사업 확인",
      description: `${matchCount}건의 맞춤 지원사업이 있어요`,
      href: "/programs",
      cta: "확인하기",
      priority: 5,
    });
  }

  // 최대 3개
  const sortedMissions = missions
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3);

  // AI 코멘트 생성 (정적, Haiku 호출 없이)
  let aiComment = "";
  if (urgentPrograms.length > 0) {
    const top = urgentPrograms[0];
    aiComment = `${company.name} 대표님, ${top.title.length > 20 ? top.title.substring(0, 20) + "..." : top.title} 마감이 ${top.dDay}일 남았어요. 적합도 ${top.matchScore || "?"}점이니 꼭 확인해보세요!`;
  } else if ((matchCount ?? 0) > 0) {
    aiComment = `${company.name} 대표님, 맞춤 지원사업 ${matchCount}건이 매칭됐어요. 가장 적합한 사업부터 확인해보세요!`;
  } else if (company.profile_score < 70) {
    aiComment = `${company.name} 대표님, AI 인터뷰를 조금만 더 진행하면 맞춤 지원사업을 찾아드릴 수 있어요!`;
  } else {
    aiComment = `${company.name} 대표님, 오늘도 좋은 지원사업을 찾아보겠습니다!`;
  }

  // 이번 주 캘린더 데이터 (월~일)
  const startOfWeek = new Date(today);
  const dayOfWeek = today.getDay();
  startOfWeek.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return d;
  });

  const weekEvents = (urgentMatchings || [])
    .filter((m: MatchingRow) => {
      if (!m.programs?.apply_end) return false;
      const endDate = new Date(m.programs.apply_end);
      return endDate >= weekDays[0] && endDate <= weekDays[6];
    })
    .map((m: MatchingRow) => ({
      date: m.programs.apply_end,
      title: m.programs.title,
      score: m.match_score,
    }));

  return (
    <DashboardClient
      companyName={company.name}
      profileScore={company.profile_score}
      matchCount={matchCount ?? 0}
      planCount={planCount ?? 0}
      docCount={docCount ?? 0}
      programCount={programCount ?? 0}
      deadlineSoonCount={deadlineSoonCount}
      missions={sortedMissions}
      aiComment={aiComment}
      urgentPrograms={urgentPrograms.slice(0, 3)}
      topMatchings={topMatchings}
      weekDays={weekDays.map((d) => d.toISOString())}
      weekEvents={weekEvents}
      extractedDocTypes={extractedDocTypes}
    />
  );
}

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProgramList } from "@/components/programs/program-list";

// Supabase join returns programs as array type, but runtime is single object
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MatchingJoinRow = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ProgramRow = Record<string, any>;

export default async function ProgramsPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const sp = await searchParams;
  const previewMode = sp.preview === "1";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: companies } = await supabase
    .from("companies")
    .select("id")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1);

  const company = companies?.[0];
  if (!company) redirect("/onboarding");

  // 매칭 결과
  const { data: matchings } = await supabase
    .from("matchings")
    .select("*, programs(*)")
    .eq("company_id", company.id)
    .order("match_score", { ascending: false });

  // 전체 프로그램 (300건까지)
  const { data: programs } = await supabase
    .from("programs")
    .select("*")
    .order("collected_at", { ascending: false })
    .limit(300);

  const matchedPrograms = matchings?.map((m: MatchingJoinRow) => ({
    ...m.programs,
    matchScore: m.match_score,
    matchReason: m.match_reason,
    matchKeywords: m.match_keywords || [],
    matchDetail: m.match_detail || "",
    scoreBreakdown: m.score_breakdown || null,
    fitLevel: m.fit_level || "",
    deepReport: m.deep_report || "",
    deepScore: m.deep_score || null,
    matchingId: m.id,
  })) ?? [];

  const unmatchedPrograms = (programs ?? []).filter(
    (p: ProgramRow) => !matchedPrograms.find((mp: ProgramRow) => mp.id === p.id)
  );

  // 소스 간 중복 제거 (제목+기관 기준, 매칭된 프로그램 우선)
  const seenTitles = new Set<string>();
  const dedupedMatched = matchedPrograms.filter((p: ProgramRow) => {
    const key = `${(p.title || "").trim().toLowerCase()}::${(p.institution || "").trim().toLowerCase()}`;
    if (seenTitles.has(key)) return false;
    seenTitles.add(key);
    return true;
  });
  const dedupedUnmatched = unmatchedPrograms.filter((p: ProgramRow) => {
    const key = `${(p.title || "").trim().toLowerCase()}::${(p.institution || "").trim().toLowerCase()}`;
    if (seenTitles.has(key)) return false;
    seenTitles.add(key);
    return true;
  });

  const allPrograms = [...dedupedMatched, ...dedupedUnmatched];

  return (
    <ProgramList
      matchedPrograms={previewMode ? [] : dedupedMatched}
      allPrograms={allPrograms}
      companyId={company.id}
    />
  );
}

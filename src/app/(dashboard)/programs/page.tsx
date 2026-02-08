import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProgramList } from "@/components/programs/program-list";

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
    <ProgramList
      matchedPrograms={matchedPrograms}
      allPrograms={allPrograms}
    />
  );
}

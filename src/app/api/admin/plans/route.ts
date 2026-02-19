import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { adminLogger as log } from "@/lib/logger";
import { requireAdmin } from "@/lib/admin/auth";

export async function GET(request: Request) {
  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const quality = searchParams.get("quality") || ""; // high|medium|low
    const sortBy = searchParams.get("sort") || "created_at";
    const sortOrder = searchParams.get("order") || "desc";
    const offset = (page - 1) * limit;

    // 사업계획서 목록
    let query = supabase
      .from("business_plans")
      .select(
        `id, title, status, created_at, company_id, program_id,
         companies(id, name, industry),
         programs(id, title)`,
        { count: "exact" }
      )
      .order("created_at", { ascending: sortOrder === "asc" })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("status", status);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%`);
    }

    const { data: plans, count, error } = await query;
    if (error) throw error;

    // 각 계획서에 품질점수, 매칭점수, 섹션수 추가
    const enriched = await Promise.all(
      (plans || []).map(async (plan) => {
        const [qualityResult, sectionResult, matchingResult] = await Promise.all([
          supabase
            .from("quality_scores")
            .select("total_score")
            .eq("plan_id", plan.id)
            .is("section_id", null)
            .order("created_at", { ascending: false })
            .limit(1),
          supabase
            .from("plan_sections")
            .select("id", { count: "exact", head: true })
            .eq("plan_id", plan.id),
          plan.program_id
            ? supabase
                .from("matchings")
                .select("match_score")
                .eq("company_id", plan.company_id)
                .eq("program_id", plan.program_id)
                .limit(1)
            : Promise.resolve({ data: null }),
        ]);

        const qualityScore = qualityResult.data?.[0]?.total_score ?? null;
        const matchScore = (matchingResult as any).data?.[0]?.match_score ?? null;

        return {
          ...plan,
          company_name: (plan as any).companies?.name || "—",
          company_industry: (plan as any).companies?.industry || "",
          program_title: (plan as any).programs?.title || null,
          quality_score: qualityScore,
          match_score: matchScore,
          section_count: sectionResult.count || 0,
        };
      })
    );

    // 품질 필터 적용 (DB 레벨이 아닌 후처리)
    let filtered = enriched;
    if (quality === "high") {
      filtered = enriched.filter((p) => p.quality_score !== null && p.quality_score >= 80);
    } else if (quality === "medium") {
      filtered = enriched.filter(
        (p) => p.quality_score !== null && p.quality_score >= 60 && p.quality_score < 80
      );
    } else if (quality === "low") {
      filtered = enriched.filter(
        (p) => p.quality_score !== null && p.quality_score < 60
      );
    }

    // 정렬
    if (sortBy === "quality_score") {
      filtered.sort((a, b) => {
        const sa = a.quality_score ?? -1;
        const sb = b.quality_score ?? -1;
        return sortOrder === "asc" ? sa - sb : sb - sa;
      });
    } else if (sortBy === "match_score") {
      filtered.sort((a, b) => {
        const sa = a.match_score ?? -1;
        const sb = b.match_score ?? -1;
        return sortOrder === "asc" ? sa - sb : sb - sa;
      });
    }

    // 통계
    const allScores = enriched.filter((p) => p.quality_score !== null);
    const stats = {
      total: count || 0,
      completed: enriched.filter((p) => p.status === "completed").length,
      avgQuality: allScores.length > 0
        ? Math.round(allScores.reduce((s, p) => s + (p.quality_score || 0), 0) / allScores.length)
        : 0,
      high: allScores.filter((p) => (p.quality_score || 0) >= 80).length,
      medium: allScores.filter((p) => (p.quality_score || 0) >= 60 && (p.quality_score || 0) < 80).length,
      low: allScores.filter((p) => (p.quality_score || 0) < 60).length,
    };

    return NextResponse.json({ plans: filtered, total: count || 0, stats });
  } catch (err) {
    log.error({ err, path: "/api/admin/plans" }, "계획서 목록 조회 실패");
    return NextResponse.json(
      { error: "계획서 목록을 조회할 수 없습니다." },
      { status: 500 }
    );
  }
}

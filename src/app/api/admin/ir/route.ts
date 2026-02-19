import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { adminLogger as log } from "@/lib/logger";
import { requireAdmin } from "@/lib/admin/auth";

/**
 * GET /api/admin/ir
 * IR 프레젠테이션 목록 (필터/정렬/페이지네이션)
 */
export async function GET(request: Request) {
  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const search = searchParams.get("search") || "";
    const template = searchParams.get("template") || "";
    const quality = searchParams.get("quality") || ""; // high|medium|low
    const sortOrder = searchParams.get("order") || "desc";
    const offset = (page - 1) * limit;

    // IR 목록
    let query = supabase
      .from("ir_presentations")
      .select(
        `id, title, template, status, created_at, plan_id, company_id,
         companies(id, name, industry),
         business_plans(id, title, program_id)`,
        { count: "exact" }
      )
      .order("created_at", { ascending: sortOrder === "asc" })
      .range(offset, offset + limit - 1);

    if (template) {
      query = query.eq("template", template);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%`);
    }

    const { data: presentations, count, error } = await query;
    if (error) throw error;

    // 각 IR에 슬라이드 수, 품질점수 추가
    const enriched = await Promise.all(
      (presentations || []).map(async (pres) => {
        const [slideResult, qualityResult] = await Promise.all([
          supabase
            .from("ir_slides")
            .select("id", { count: "exact", head: true })
            .eq("presentation_id", pres.id),
          supabase
            .from("ppt_quality_scores")
            .select("total_score")
            .eq("presentation_id", pres.id)
            .order("created_at", { ascending: false })
            .limit(1),
        ]);

        const qualityScore = qualityResult.data?.[0]?.total_score ?? null;

        return {
          ...pres,
          company_name: (pres as any).companies?.name || "—",
          company_industry: (pres as any).companies?.industry || "",
          plan_title: (pres as any).business_plans?.title || null,
          slide_count: slideResult.count || 0,
          quality_score: qualityScore,
        };
      })
    );

    // 품질 필터 적용 (후처리)
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
      templates: {
        minimal: enriched.filter((p) => p.template === "minimal").length,
        tech: enriched.filter((p) => p.template === "tech").length,
        classic: enriched.filter((p) => p.template === "classic").length,
      },
    };

    return NextResponse.json({ presentations: filtered, total: count || 0, stats });
  } catch (err) {
    log.error({ err, path: "/api/admin/ir" }, "IR 목록 조회 실패");
    return NextResponse.json(
      { error: "IR 목록을 조회할 수 없습니다." },
      { status: 500 }
    );
  }
}

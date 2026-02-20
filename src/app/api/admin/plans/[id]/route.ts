import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { adminLogger as log } from "@/lib/logger";
import { requireAdmin } from "@/lib/admin/auth";

/**
 * GET /api/admin/plans/[id]
 * 사업계획서 상세 (섹션 미리보기, 품질점수 상세)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: planId } = await params;

  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const supabase = createAdminClient();

    // 계획서 기본 정보
    const { data: plan, error: planError } = await supabase
      .from("business_plans")
      .select(`
        id, title, status, created_at, updated_at, company_id, program_id,
        companies(id, name, industry, region),
        programs(id, title, institution, apply_end)
      `)
      .eq("id", planId)
      .single();

    if (planError || !plan) {
      return NextResponse.json({ error: "계획서를 찾을 수 없습니다." }, { status: 404 });
    }

    // 섹션, 품질점수, 매칭점수, IR 프레젠테이션 동시 로드
    const [sectionsResult, qualityResult, matchingResult, irResult] = await Promise.all([
      supabase
        .from("plan_sections")
        .select("id, section_name, section_order, content, generation_count, created_at")
        .eq("plan_id", planId)
        .order("section_order"),
      supabase
        .from("quality_scores")
        .select("*")
        .eq("plan_id", planId)
        .order("created_at", { ascending: false }),
      plan.program_id
        ? supabase
            .from("matchings")
            .select("match_score, match_reason, fit_level, match_keywords, score_breakdown")
            .eq("company_id", plan.company_id)
            .eq("program_id", plan.program_id)
            .limit(1)
        : Promise.resolve({ data: null }),
      supabase
        .from("ir_presentations")
        .select("id, title, template, status, created_at")
        .eq("plan_id", planId)
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    type SectionRow = { id: string; section_name: string; section_order: number; content: string | null; generation_count: number; created_at: string };
    type QualityRow = { section_id: string | null; total_score: number; criteria_scores: unknown; feedback: string | null; created_at: string };

    const sections = (sectionsResult.data || []).map((s: SectionRow) => ({
      ...s,
      content_preview: s.content ? s.content.substring(0, 500) + (s.content.length > 500 ? "..." : "") : "",
      content_length: s.content ? s.content.length : 0,
    }));

    // 품질점수: 전체(section_id=null) + 섹션별
    const overallQuality = (qualityResult.data || []).find((q: QualityRow) => !q.section_id);
    const sectionQualities = (qualityResult.data || []).filter((q: QualityRow) => q.section_id);

    const matching = (matchingResult as { data?: Record<string, unknown>[] | null })?.data?.[0] || null;
    const irPresentation = irResult.data?.[0] || null;

    return NextResponse.json({
      plan: {
        ...plan,
        company_name: (plan as { companies?: { name?: string; industry?: string; region?: string } | null }).companies?.name || "—",
        company_industry: (plan as { companies?: { name?: string; industry?: string; region?: string } | null }).companies?.industry || "",
        company_region: (plan as { companies?: { name?: string; industry?: string; region?: string } | null }).companies?.region || "",
        program_title: (plan as { programs?: { title?: string; institution?: string } | null }).programs?.title || null,
        program_institution: (plan as { programs?: { title?: string; institution?: string } | null }).programs?.institution || null,
      },
      sections,
      quality: {
        overall: overallQuality
          ? {
              total_score: overallQuality.total_score,
              criteria_scores: overallQuality.criteria_scores,
              feedback: overallQuality.feedback,
              created_at: overallQuality.created_at,
            }
          : null,
        by_section: sectionQualities.map((q: QualityRow) => ({
          section_id: q.section_id,
          total_score: q.total_score,
          criteria_scores: q.criteria_scores,
        })),
      },
      matching,
      ir_presentation: irPresentation,
    });
  } catch (err) {
    log.error({ err, planId }, "계획서 상세 조회 실패");
    return NextResponse.json(
      { error: "계획서 상세를 조회할 수 없습니다." },
      { status: 500 }
    );
  }
}

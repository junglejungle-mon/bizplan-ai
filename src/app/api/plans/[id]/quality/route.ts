import { createClient } from "@/lib/supabase/server";
import { scorePlan, getScoresForPlan } from "@/lib/quality/scorer";

/**
 * GET /api/plans/[id]/quality
 * 사용자용 품질 점수 조회 (섹션별 점수 + 개선 제안)
 *
 * POST /api/plans/[id]/quality
 * 품질 평가 실행 (전체 섹션 채점 + 계획서 평균 업데이트)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: planId } = await params;
    const supabase = await createClient();

    // 인증 확인
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 계획서 소유자 확인
    const { data: plan } = await supabase
      .from("business_plans")
      .select("id, quality_score, user_id")
      .eq("id", planId)
      .single();

    if (!plan || plan.user_id !== user.id) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    // 섹션별 품질 점수 조회
    const scores = await getScoresForPlan(planId);

    // 개선 제안 통합 (중복 제거, 상위 5개)
    const allSuggestions = scores.flatMap((s) => s.improvement_suggestions || []);
    const uniqueSuggestions = [...new Set(allSuggestions)].slice(0, 5);

    return Response.json({
      planId,
      overallScore: plan.quality_score || 0,
      sectionScores: scores.map((s) => ({
        sectionId: s.section_id,
        totalScore: s.total_score,
        breakdown: {
          numericEvidence: s.score_numeric_evidence,
          tamSamSom: s.score_tam_sam_som,
          competitorAnalysis: s.score_competitor_analysis,
          roadmap: s.score_roadmap,
          teamCapability: s.score_team_capability,
          budgetBasis: s.score_budget_basis,
          riskMitigation: s.score_risk_mitigation,
          ipPatent: s.score_ip_patent,
          socialValue: s.score_social_value,
          documentFit: s.score_document_fit,
          chartsTables: s.score_charts_tables,
        },
        suggestions: s.improvement_suggestions || [],
        scoredAt: s.scored_at,
      })),
      topSuggestions: uniqueSuggestions,
      grade:
        (plan.quality_score || 0) >= 80
          ? "A"
          : (plan.quality_score || 0) >= 60
            ? "B"
            : (plan.quality_score || 0) >= 40
              ? "C"
              : "D",
    });
  } catch (error) {
    console.error("[Quality] 점수 조회 실패:", error);
    return Response.json(
      { error: "Failed to fetch quality scores" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: planId } = await params;
    const supabase = await createClient();

    // 인증 확인
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 계획서 소유자 확인
    const { data: plan } = await supabase
      .from("business_plans")
      .select("id, user_id, status")
      .eq("id", planId)
      .single();

    if (!plan || plan.user_id !== user.id) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    if (plan.status !== "completed") {
      return Response.json(
        { error: "계획서 생성이 완료된 후 품질 평가가 가능합니다." },
        { status: 400 }
      );
    }

    // 품질 평가 실행
    const result = await scorePlan(planId);

    return Response.json({
      success: true,
      overallScore: result,
      message: "품질 평가가 완료되었습니다.",
    });
  } catch (error) {
    console.error("[Quality] 평가 실행 실패:", error);
    return Response.json(
      { error: "Failed to run quality evaluation" },
      { status: 500 }
    );
  }
}

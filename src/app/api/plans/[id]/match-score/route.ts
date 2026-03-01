import { createClient } from "@/lib/supabase/server";
import { calculateProgramMatchScore } from "@/lib/quality/program-match-scorer";

/**
 * GET /api/plans/[id]/match-score
 * 공고 ↔ 사업계획서 매칭 점수 조회
 *
 * POST /api/plans/[id]/match-score
 * 공고 ↔ 사업계획서 매칭 점수 계산 실행
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: planId } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 계획서 + 프로그램 정보 로드
    const { data: plan } = await supabase
      .from("business_plans")
      .select("id, user_id, program_id, quality_score, match_score, match_grade")
      .eq("id", planId)
      .single();

    if (!plan || plan.user_id !== user.id) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return Response.json({
      planId,
      programId: plan.program_id,
      matchScore: plan.match_score || null,
      matchGrade: plan.match_grade || null,
      qualityScore: plan.quality_score || null,
    });
  } catch (error) {
    console.error("[MatchScore] 조회 실패:", error);
    return Response.json(
      { error: "Failed to fetch match score" },
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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 계획서 확인
    const { data: plan } = await supabase
      .from("business_plans")
      .select("id, user_id, status, program_id")
      .eq("id", planId)
      .single();

    if (!plan || plan.user_id !== user.id) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    if (plan.status !== "completed") {
      return Response.json(
        { error: "계획서 생성이 완료된 후 매칭 점수 평가가 가능합니다." },
        { status: 400 }
      );
    }

    if (!plan.program_id) {
      return Response.json(
        { error: "공고와 연결된 사업계획서만 매칭 점수를 계산할 수 있습니다." },
        { status: 400 }
      );
    }

    // 매칭 점수 계산 실행
    const result = await calculateProgramMatchScore(planId, plan.program_id);

    return Response.json({
      success: true,
      result,
      message: result.is_submittable
        ? "🎉 이 사업계획서는 공고 요구사항을 충분히 충족합니다. 그대로 제출 가능합니다!"
        : `매칭 점수: ${result.overall_score}점 (${result.grade}등급). 개선이 필요한 부분이 있습니다.`,
    });
  } catch (error) {
    console.error("[MatchScore] 계산 실패:", error);
    return Response.json(
      { error: "Failed to calculate match score" },
      { status: 500 }
    );
  }
}

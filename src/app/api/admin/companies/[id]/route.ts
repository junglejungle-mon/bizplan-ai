import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const { id } = await params;
    const supabase = createAdminClient();

    // 업체 기본 정보
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select(
        `
        *,
        profiles!inner(id, email, name)
      `
      )
      .eq("id", id)
      .single();

    if (companyError || !company) {
      return NextResponse.json(
        { error: "업체를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 인터뷰, 매칭, 사업계획서 병렬 조회
    const [interviews, matchings, plans] = await Promise.all([
      supabase
        .from("company_interviews")
        .select("id, question, answer, category, round, extracted_insights, question_order, created_at")
        .eq("company_id", id)
        .order("round")
        .order("question_order"),
      supabase
        .from("matchings")
        .select(
          `
          id, match_score, match_reason, match_detail, fit_level, status,
          match_keywords, score_breakdown, region_match, created_at,
          programs!inner(id, title, institution, apply_start, apply_end, source)
        `
        )
        .eq("company_id", id)
        .order("match_score", { ascending: false }),
      supabase
        .from("business_plans")
        .select("id, title, status, created_at, updated_at")
        .eq("company_id", id)
        .order("created_at", { ascending: false }),
    ]);

    return NextResponse.json({
      company,
      interviews: interviews.data || [],
      matchings: matchings.data || [],
      plans: plans.data || [],
    });
  } catch (err) {
    console.error("업체 상세 조회 실패:", err);
    return NextResponse.json(
      { error: "업체 상세 정보를 조회할 수 없습니다." },
      { status: 500 }
    );
  }
}

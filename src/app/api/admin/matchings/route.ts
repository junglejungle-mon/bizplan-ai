import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";

export async function GET(request: Request) {
  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const fitLevel = searchParams.get("fit_level") || "";
    const programId = searchParams.get("program_id") || "";
    const offset = (page - 1) * limit;

    // 매칭 목록
    let query = supabase
      .from("matchings")
      .select(
        `
        id, match_score, match_reason, match_detail, fit_level, status,
        match_keywords, score_breakdown, region_match, created_at,
        companies!inner(id, name, industry, region),
        programs!inner(id, title, institution, apply_start, apply_end)
      `,
        { count: "exact" }
      )
      .order("match_score", { ascending: false })
      .range(offset, offset + limit - 1);

    if (fitLevel) {
      query = query.eq("fit_level", fitLevel);
    }
    if (programId) {
      query = query.eq("program_id", programId);
    }

    const { data: matchings, count, error } = await query;
    if (error) throw error;

    // 적합도 분포 통계
    const { data: allMatchings } = await supabase
      .from("matchings")
      .select("fit_level, match_score");

    const distribution: Record<string, number> = {};
    let totalScore = 0;
    (allMatchings || []).forEach((m) => {
      const level = m.fit_level || "미분류";
      distribution[level] = (distribution[level] || 0) + 1;
      totalScore += m.match_score || 0;
    });

    const avgScore =
      allMatchings && allMatchings.length > 0
        ? Math.round(totalScore / allMatchings.length)
        : 0;

    // 프로그램별 매칭 수 TOP 10
    const { data: programStats } = await supabase
      .from("matchings")
      .select("program_id, programs!inner(title)");

    const programCounts: Record<string, { title: string; count: number }> = {};
    (programStats || []).forEach((m) => {
      const pid = m.program_id;
      const title = (m as Record<string, unknown>).programs
        ? ((m as Record<string, unknown>).programs as Record<string, string>)
            .title
        : "알 수 없음";
      if (!programCounts[pid]) {
        programCounts[pid] = { title, count: 0 };
      }
      programCounts[pid].count++;
    });

    const topPrograms = Object.entries(programCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([id, data]) => ({ id, ...data }));

    return NextResponse.json({
      matchings: matchings || [],
      total: count || 0,
      stats: {
        distribution,
        avgScore,
        totalMatchings: allMatchings?.length || 0,
        topPrograms,
      },
    });
  } catch (err) {
    console.error("매칭 현황 조회 실패:", err);
    return NextResponse.json(
      { error: "매칭 현황을 조회할 수 없습니다." },
      { status: 500 }
    );
  }
}

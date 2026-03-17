import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runMatchingPipeline } from "@/lib/pipeline/matcher";

// Vercel Pro: 최대 300초
export const maxDuration = 300;

/**
 * GET /api/cron/auto-match
 * Vercel Cron: 수집 10분 뒤 (00:10, 06:10 UTC = 09:10, 15:10 KST)
 *
 * 신규 수집된 프로그램이 있으면 모든 활성 회사에 대해 매칭 실행
 * 매칭 결과 카카오톡 알림은 runMatchingPipeline 내부에서 자동 발송
 */
export async function GET(request: NextRequest) {
  // Cron 인증
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // CRON_SECRET 미설정 시 항상 거부
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createAdminClient();

  try {
    // 1. 최근 2시간 내 수집된 프로그램 수 확인
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const { count: newProgramCount } = await supabase
      .from("programs")
      .select("*", { count: "exact", head: true })
      .gte("collected_at", twoHoursAgo);

    if (!newProgramCount || newProgramCount === 0) {
      return Response.json({
        success: true,
        message: "신규 프로그램 없음 - 매칭 스킵",
        newPrograms: 0,
        timestamp: new Date().toISOString(),
      });
    }

    // 2. 프로필이 완성된 모든 회사 조회 (profile_score >= 20 + business_content 존재)
    const { data: companies } = await supabase
      .from("companies")
      .select("id, name, profile_score")
      .gte("profile_score", 20)
      .not("business_content", "is", null);

    if (!companies || companies.length === 0) {
      return Response.json({
        success: true,
        message: "매칭 대상 회사 없음",
        newPrograms: newProgramCount,
        companies: 0,
        timestamp: new Date().toISOString(),
      });
    }

    // 3. 각 회사별 매칭 실행
    const results: Array<{
      companyId: string;
      companyName: string;
      matched: number;
      skipped: number;
      deepAnalyzed: number;
      errors: string[];
    }> = [];

    for (const company of companies) {
      try {
        const result = await runMatchingPipeline(company.id);
        results.push({
          companyId: company.id,
          companyName: company.name,
          ...result,
        });
      } catch (e) {
        console.error(`[AutoMatch] ${company.name} 매칭 실패:`, e);
        results.push({
          companyId: company.id,
          companyName: company.name,
          matched: 0,
          skipped: 0,
          deepAnalyzed: 0,
          errors: [String(e)],
        });
      }
    }

    const totalMatched = results.reduce((s, r) => s + r.matched, 0);
    const totalDeep = results.reduce((s, r) => s + r.deepAnalyzed, 0);

    return Response.json({
      success: true,
      newPrograms: newProgramCount,
      companies: companies.length,
      totalMatched,
      totalDeepAnalyzed: totalDeep,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[AutoMatch] 자동매칭 실패:", error);
    return Response.json(
      {
        success: false,
        error: String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

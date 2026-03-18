import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runMatchingPipeline } from "@/lib/pipeline/matcher";
import { rateLimitAsync, getClientIP, RATE_LIMITS, rateLimitResponse } from "@/lib/utils/rate-limit";

/**
 * POST /api/matching
 * 매칭 파이프라인 실행
 */
export async function POST(request: NextRequest) {
  // AI 매칭 비용 보호: 분당 5회 제한
  const ip = getClientIP(request);
  const rl = await rateLimitAsync(`matching:${ip}`, RATE_LIMITS.AI_GENERATE);
  if (!rl.success) return rateLimitResponse(rl);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { companyId } = await request.json();

  if (!companyId) {
    return Response.json({ error: "companyId required" }, { status: 400 });
  }

  // 회사 소유자 확인
  const { data: company } = await supabase
    .from("companies")
    .select("id, user_id")
    .eq("id", companyId)
    .single();

  if (!company || company.user_id !== user.id) {
    return Response.json({ error: "Company not found" }, { status: 404 });
  }

  try {
    const result = await runMatchingPipeline(companyId);

    return Response.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Matching] 매칭 실패:", error);
    return Response.json(
      {
        success: false,
        error: "처리 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}

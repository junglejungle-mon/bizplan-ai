import { NextRequest } from "next/server";
import { collectAllPrograms } from "@/lib/pipeline/collector";

// Vercel Serverless Function 타임아웃 확대 (Hobby: 최대 60초, Pro: 최대 300초)
export const maxDuration = 300;

/**
 * GET /api/programs/collect
 * Vercel Cron Job: 매일 09:00 (KST) = 00:00 (UTC)
 * 전체 페이지 수집 + 자동 매칭 트리거
 * 수동 호출도 가능 (인증 필요)
 */
export async function GET(request: NextRequest) {
  // Vercel Cron 인증 체크
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // Vercel Cron에서 호출 시 CRON_SECRET 체크, 없으면 허용 (개발 환경)
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const result = await collectAllPrograms();

    return Response.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Collect] 전체 수집 실패:", error);
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

import { NextRequest, NextResponse } from "next/server";
import { processExpiredSubscriptions } from "@/lib/payment/subscription";
import { apiError } from "@/lib/api/error";

/**
 * POST /api/subscriptions/process-expired
 * 만료된 Trial/구독 일괄 처리 (cron/n8n에서 호출)
 * Authorization: Bearer <CRON_SECRET> 으로 보호
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET 환경변수가 설정되지 않았습니다" },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processExpiredSubscriptions();

    return NextResponse.json({
      success: true,
      processed: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return apiError(error, "만료 처리 실패", 500);
  }
}

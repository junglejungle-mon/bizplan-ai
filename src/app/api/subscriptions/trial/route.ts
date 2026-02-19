import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createTrialSubscription, getPlanByName } from "@/lib/payment/subscription";
import { apiError } from "@/lib/api/error";
import { rateLimitAsync, getClientIP, RATE_LIMITS, rateLimitResponse } from "@/lib/utils/rate-limit";

/**
 * POST /api/subscriptions/trial
 * 14일 무료 체험 구독 생성
 */
export async function POST(request: Request) {
  try {
    // 무료체험 남용 방지: 분당 10회 제한
    const ip = getClientIP(request);
    const rl = await rateLimitAsync(`trial:${ip}`, RATE_LIMITS.AUTH);
    if (!rl.success) return rateLimitResponse(rl);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    // 기본 Trial 플랜 조회 (Pro 플랜 기준)
    const plan = await getPlanByName("Pro");
    if (!plan) {
      return NextResponse.json(
        { error: "Trial 플랜을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    const subscription = await createTrialSubscription({
      userId: user.id,
      planId: plan.id,
    });

    return NextResponse.json({
      success: true,
      subscription,
      message: "14일 무료 체험이 시작되었습니다!",
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("이미 무료 체험")) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      );
    }
    return apiError(error, "Trial 생성 실패", 500);
  }
}

/**
 * POST /api/subscriptions/cancel
 * 구독 취소 (기간 끝까지 유지)
 */

import { createClient } from "@/lib/supabase/server";
import { getActiveSubscription, cancelSubscription } from "@/lib/payment/subscription";
import { apiError } from "@/lib/api/error";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const subscription = await getActiveSubscription(user.id);

    if (!subscription) {
      return Response.json({ error: "활성 구독이 없습니다." }, { status: 404 });
    }

    if (subscription.cancel_at_period_end) {
      return Response.json({ error: "이미 취소 예약된 구독입니다." }, { status: 400 });
    }

    // 무료 플랜은 취소 불가
    if (subscription.plan.price === 0) {
      return Response.json({ error: "무료 플랜은 취소할 수 없습니다." }, { status: 400 });
    }

    const updated = await cancelSubscription(subscription.id, user.id);

    return Response.json({
      success: true,
      subscription: {
        id: updated.id,
        status: updated.status,
        cancelAtPeriodEnd: updated.cancel_at_period_end,
        currentPeriodEnd: updated.current_period_end,
      },
      message: `구독이 ${updated.current_period_end ? new Date(updated.current_period_end).toLocaleDateString("ko-KR") : "기간 종료 시"} 만료됩니다.`,
    });
  } catch (error) {
    console.error("[cancel] 오류:", error);
    return apiError(error, "구독 취소 실패", 500);
  }
}

/**
 * GET /api/subscriptions
 * 현재 사용자의 활성 구독 조회
 */

import { createClient } from "@/lib/supabase/server";
import { getActiveSubscription } from "@/lib/payment/subscription";
import { getUsageSummary } from "@/lib/payment/usage";
import { apiError } from "@/lib/api/error";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const subscription = await getActiveSubscription(user.id);
    const usage = await getUsageSummary(user.id);

    return Response.json({
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            currentPeriodStart: subscription.current_period_start,
            currentPeriodEnd: subscription.current_period_end,
            plan: {
              id: subscription.plan.id,
              name: subscription.plan.name,
              displayName: subscription.plan.display_name,
              price: subscription.plan.price,
              features: subscription.plan.features,
              limits: subscription.plan.limits,
            },
          }
        : null,
      usage,
    });
  } catch (error) {
    console.error("[subscriptions] 조회 오류:", error);
    return apiError(error, "구독 조회 실패", 500);
  }
}

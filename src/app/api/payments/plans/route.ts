/**
 * GET /api/payments/plans
 * 활성 플랜 목록 조회 (공개 API)
 */

import { getActivePlans } from "@/lib/payment/subscription";
import { apiError } from "@/lib/api/error";

export async function GET() {
  try {
    const plans = await getActivePlans();

    return Response.json({
      plans: plans.map((p) => ({
        id: p.id,
        name: p.name,
        display_name: p.display_name,
        description: p.description,
        price: p.price,
        currency: p.currency,
        interval: p.interval,
        features: p.features,
        limits: p.limits,
        sort_order: p.sort_order,
      })),
    });
  } catch (error) {
    console.error("[plans] 조회 오류:", error);
    return apiError(error, "플랜 조회 실패", 500);
  }
}

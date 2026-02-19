/**
 * POST /api/payments/checkout
 * 결제 시작: pending 레코드 생성 + PortOne 파라미터 반환
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildCheckoutParams } from "@/lib/payment/portone";
import { getPlanById } from "@/lib/payment/subscription";
import { createPaymentRecord } from "@/lib/payment/subscription";
import { apiError } from "@/lib/api/error";
import { rateLimitAsync, getClientIP, RATE_LIMITS, rateLimitResponse } from "@/lib/utils/rate-limit";
import { validateBody, checkoutSchema } from "@/lib/api/validation";

export async function POST(request: NextRequest) {
  // 결제 남용 방지: 분당 60회 제한
  const ip = getClientIP(request);
  const rl = await rateLimitAsync(`checkout:${ip}`, RATE_LIMITS.API);
  if (!rl.success) return rateLimitResponse(rl);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const [body, validationError] = await validateBody(request, checkoutSchema);
    if (validationError) return validationError;
    const { planId } = body;

    // 플랜 조회
    const plan = await getPlanById(planId);
    if (!plan || !plan.is_active) {
      return Response.json({ error: "유효하지 않은 플랜입니다." }, { status: 404 });
    }

    if (plan.price === 0) {
      return Response.json({ error: "무료 플랜은 결제가 필요 없습니다." }, { status: 400 });
    }

    // 고유 결제 ID 생성
    const paymentId = `payment_${Date.now()}_${user.id.slice(0, 8)}`;

    // pending 결제 레코드 생성
    await createPaymentRecord({
      userId: user.id,
      amount: plan.price,
      portonePaymentId: paymentId,
    });

    // 사용자 프로필 조회
    const { data: profile } = await supabase
      .from("profiles")
      .select("name, email, phone")
      .eq("id", user.id)
      .single();

    // 클라이언트용 결제 파라미터 생성
    const checkoutParams = buildCheckoutParams({
      paymentId,
      planName: plan.display_name,
      amount: plan.price,
      userId: user.id,
      userName: profile?.name || undefined,
      userEmail: profile?.email || user.email || undefined,
      userPhone: profile?.phone || undefined,
    });

    return Response.json({
      checkoutParams,
      planId: plan.id,
      planName: plan.display_name,
    });
  } catch (error) {
    console.error("[checkout] 오류:", error);
    return apiError(error, "결제 시작 실패", 500);
  }
}

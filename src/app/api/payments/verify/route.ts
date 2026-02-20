/**
 * POST /api/payments/verify
 * 결제 검증: PortOne API 조회 → 금액 확인 → 구독 생성
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPayment, verifyPaymentAmount } from "@/lib/payment/portone";
import {
  createSubscription,
  upgradeSubscription,
  updatePaymentStatus,
} from "@/lib/payment/subscription";
import type { ProrateResult } from "@/lib/payment/subscription";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError } from "@/lib/api/error";
import { rateLimitAsync, getClientIP, RATE_LIMITS, rateLimitResponse } from "@/lib/utils/rate-limit";
import { validateBody, verifyPaymentSchema } from "@/lib/api/validation";

export async function POST(request: NextRequest) {
  // 결제 검증 남용 방지
  const ip = getClientIP(request);
  const rl = await rateLimitAsync(`verify:${ip}`, RATE_LIMITS.API);
  if (!rl.success) return rateLimitResponse(rl);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const [body, validationError] = await validateBody(request, verifyPaymentSchema);
    if (validationError) return validationError;
    const { paymentId, planId } = body;

    // DB에서 pending 결제 확인
    const adminSupabase = createAdminClient();
    const { data: paymentRecord } = await adminSupabase
      .from("payments")
      .select("*")
      .eq("portone_payment_id", paymentId)
      .eq("user_id", user.id)
      .single();

    if (!paymentRecord) {
      return Response.json({ error: "결제 기록을 찾을 수 없습니다." }, { status: 404 });
    }

    if (paymentRecord.status !== "pending") {
      return Response.json({ error: "이미 처리된 결제입니다." }, { status: 400 });
    }

    // PortOne API로 결제 확인
    const portonePayment = await getPayment(paymentId);

    // 결제 금액 검증
    if (!verifyPaymentAmount(portonePayment, paymentRecord.amount)) {
      await updatePaymentStatus({
        portonePaymentId: paymentId,
        status: "failed",
        failedReason: `금액 불일치 또는 미결제: status=${portonePayment.status}, amount=${portonePayment.amount.total}`,
      });

      return Response.json(
        { error: "결제 금액이 일치하지 않습니다." },
        { status: 400 }
      );
    }

    // 업그레이드 결제인지 확인
    const metadata = (paymentRecord.metadata || {}) as Record<string, unknown>;
    const isUpgrade = metadata.type === "upgrade";
    const prorationData = metadata.proration as ProrateResult | undefined;

    // 구독 생성 (업그레이드 vs 신규)
    const subscription = isUpgrade && prorationData
      ? await upgradeSubscription({
          userId: user.id,
          newPlanId: planId,
          portonePaymentId: paymentId,
          proration: prorationData,
        })
      : await createSubscription({
          userId: user.id,
          planId,
          portonePaymentId: paymentId,
        });

    // 결제 상태 → paid
    const methodType = portonePayment.method?.type || "unknown";
    const easyPayProvider = portonePayment.method?.easyPay?.provider;

    await updatePaymentStatus({
      portonePaymentId: paymentId,
      status: "paid",
      paidAt: portonePayment.paidAt || new Date().toISOString(),
      paymentMethod: easyPayProvider || methodType,
      paymentMethodDetail: portonePayment.method as Record<string, unknown> || {},
      receiptUrl: portonePayment.receiptUrl || undefined,
      subscriptionId: subscription.id,
    });

    return Response.json({
      success: true,
      subscription: {
        id: subscription.id,
        planId: subscription.plan_id,
        status: subscription.status,
        currentPeriodEnd: subscription.current_period_end,
      },
    });
  } catch (error) {
    console.error("[verify] 오류:", error);
    return apiError(error, "결제 검증 실패", 500);
  }
}

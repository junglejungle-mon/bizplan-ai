/**
 * GET  /api/payments/upgrade?planId=xxx  — 업그레이드 비례환불 프리뷰
 * POST /api/payments/upgrade              — 업그레이드 결제 시작 (비례환불 적용)
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildCheckoutParams } from "@/lib/payment/portone";
import {
  getPlanById,
  getActiveSubscription,
  calculateProration,
  createPaymentRecord,
} from "@/lib/payment/subscription";
import { apiError } from "@/lib/api/error";
import { rateLimitAsync, getClientIP, RATE_LIMITS, rateLimitResponse } from "@/lib/utils/rate-limit";
import { validateBody, upgradeSchema } from "@/lib/api/validation";

/**
 * GET /api/payments/upgrade?planId=xxx
 * 업그레이드 시 비례환불 금액 프리뷰
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const planId = request.nextUrl.searchParams.get("planId");
    if (!planId) {
      return Response.json({ error: "planId 파라미터가 필요합니다." }, { status: 400 });
    }

    // 새 플랜 조회
    const newPlan = await getPlanById(planId);
    if (!newPlan || !newPlan.is_active) {
      return Response.json({ error: "유효하지 않은 플랜입니다." }, { status: 404 });
    }

    if (Number(newPlan.price) === 0) {
      return Response.json({ error: "무료 플랜으로의 변경은 구독 취소를 이용해주세요." }, { status: 400 });
    }

    // 현재 활성 구독 조회
    const currentSub = await getActiveSubscription(user.id);

    if (!currentSub) {
      // 활성 구독이 없으면 비례환불 없이 전액 결제
      return Response.json({
        proration: null,
        chargeAmount: Number(newPlan.price),
        newPlanName: newPlan.display_name,
        newPlanPrice: Number(newPlan.price),
        message: "현재 활성 구독이 없어 전액 결제됩니다.",
      });
    }

    // 같은 플랜으로 변경 시
    if (currentSub.plan_id === planId) {
      return Response.json({ error: "이미 같은 플랜을 사용 중입니다." }, { status: 400 });
    }

    // 비례환불 계산
    const proration = calculateProration(currentSub, newPlan);

    return Response.json({
      proration: {
        currentPlanName: currentSub.plan.display_name,
        remainingDays: proration.remainingDays,
        totalDays: proration.totalDays,
        credit: proration.credit,
        creditFormatted: `${proration.credit.toLocaleString()}원`,
      },
      chargeAmount: proration.chargeAmount,
      chargeAmountFormatted: `${proration.chargeAmount.toLocaleString()}원`,
      newPlanName: newPlan.display_name,
      newPlanPrice: proration.newPlanPrice,
      newPlanPriceFormatted: `${proration.newPlanPrice.toLocaleString()}원`,
      message: proration.credit > 0
        ? `현재 ${currentSub.plan.display_name} 플랜의 남은 ${proration.remainingDays}일분(${proration.credit.toLocaleString()}원)이 차감됩니다.`
        : undefined,
    });
  } catch (error) {
    console.error("[upgrade/preview] 오류:", error);
    return apiError(error, "업그레이드 프리뷰 실패", 500);
  }
}

/**
 * POST /api/payments/upgrade
 * 업그레이드 결제 시작 (비례환불 적용)
 */
export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const rl = await rateLimitAsync(`upgrade:${ip}`, RATE_LIMITS.API);
  if (!rl.success) return rateLimitResponse(rl);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const [upgradeBody, upgradeErr] = await validateBody(request, upgradeSchema);
    if (upgradeErr) return upgradeErr;
    const { planId } = upgradeBody;

    // 새 플랜 조회
    const newPlan = await getPlanById(planId);
    if (!newPlan || !newPlan.is_active) {
      return Response.json({ error: "유효하지 않은 플랜입니다." }, { status: 404 });
    }

    if (Number(newPlan.price) === 0) {
      return Response.json({ error: "무료 플랜으로의 변경은 구독 취소를 이용해주세요." }, { status: 400 });
    }

    // 현재 활성 구독 조회
    const currentSub = await getActiveSubscription(user.id);

    if (currentSub?.plan_id === planId) {
      return Response.json({ error: "이미 같은 플랜을 사용 중입니다." }, { status: 400 });
    }

    // 비례환불 계산
    let chargeAmount = Number(newPlan.price);
    let proration = null;

    if (currentSub) {
      proration = calculateProration(currentSub, newPlan);
      chargeAmount = proration.chargeAmount;
    }

    // 크레딧으로 완전 충당되는 경우 (결제 불요)
    if (chargeAmount === 0 && proration) {
      // 결제 없이 바로 구독 전환
      const { upgradeSubscription } = await import("@/lib/payment/subscription");
      const newSub = await upgradeSubscription({
        userId: user.id,
        newPlanId: planId,
        proration,
      });

      return Response.json({
        success: true,
        freeUpgrade: true,
        subscriptionId: newSub.id,
        message: "잔여 크레딧으로 업그레이드가 완료되었습니다.",
      });
    }

    // 결제 필요 → pending 결제 레코드 + PortOne 파라미터
    const paymentId = crypto.randomUUID();

    await createPaymentRecord({
      userId: user.id,
      amount: chargeAmount,
      portonePaymentId: paymentId,
      planId: newPlan.id,
      metadata: {
        type: "upgrade",
        proration: proration
          ? {
              credit: proration.credit,
              remaining_days: proration.remainingDays,
              original_price: proration.newPlanPrice,
            }
          : null,
      },
    });

    // 사용자 프로필 조회
    const { data: profile } = await supabase
      .from("profiles")
      .select("name, email, phone")
      .eq("id", user.id)
      .single();

    const checkoutParams = buildCheckoutParams({
      paymentId,
      planName: `${newPlan.display_name} (업그레이드)`,
      amount: chargeAmount,
      userId: user.id,
      userName: profile?.name || undefined,
      userEmail: profile?.email || user.email || undefined,
      userPhone: profile?.phone || undefined,
    });

    return Response.json({
      checkoutParams,
      planId: newPlan.id,
      planName: newPlan.display_name,
      chargeAmount,
      proration: proration
        ? {
            credit: proration.credit,
            remainingDays: proration.remainingDays,
          }
        : null,
    });
  } catch (error) {
    console.error("[upgrade/checkout] 오류:", error);
    return apiError(error, "업그레이드 결제 시작 실패", 500);
  }
}

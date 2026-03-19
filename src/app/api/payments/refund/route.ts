/**
 * POST /api/payments/refund
 * 사용자: 셀프서비스 환불 요청
 * - 결제 후 7일 이내 & 서비스 미이용 시 전액 환불
 * - 그 외에는 환불 요청 접수 (관리자 수동 처리)
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError } from "@/lib/api/error";
import { rateLimitAsync, getClientIP, RATE_LIMITS, rateLimitResponse } from "@/lib/utils/rate-limit";
import { validateBody, refundSchema } from "@/lib/api/validation";

export async function POST(request: Request) {
  try {
    // 환불 남용 방지
    const ip = getClientIP(request);
    const rl = await rateLimitAsync(`refund:${ip}`, RATE_LIMITS.AUTH);
    if (!rl.success) return rateLimitResponse(rl);
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const [refBody, refErr] = await validateBody(request, refundSchema);
    if (refErr) return refErr;
    const { paymentId, reason } = refBody;

    const adminSupabase = createAdminClient();

    // 1. 결제 정보 확인 (본인 결제인지 검증)
    const { data: payment, error: paymentError } = await adminSupabase
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .eq("user_id", user.id)
      .single();

    if (paymentError || !payment) {
      return Response.json({ error: "결제 정보를 찾을 수 없습니다." }, { status: 404 });
    }

    if (payment.status === "refunded") {
      return Response.json({ error: "이미 환불된 결제입니다." }, { status: 400 });
    }

    if (payment.status !== "paid") {
      return Response.json(
        { error: `결제 상태가 '${payment.status}'이므로 환불 요청할 수 없습니다.` },
        { status: 400 }
      );
    }

    // 2. 기존에 환불 요청이 있는지 확인 (중복 방지)
    const existingMeta = payment.metadata as Record<string, unknown> | null;
    if (existingMeta?.refund_requested) {
      return Response.json(
        { error: "이미 환불 요청이 접수되어 있습니다. 영업일 기준 3~5일 내 처리됩니다." },
        { status: 400 }
      );
    }

    // 3. 결제 후 7일 이내인지 확인
    const paidAt = payment.paid_at ? new Date(payment.paid_at) : new Date(payment.created_at);
    const daysSincePaid = Math.floor(
      (Date.now() - paidAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    // 4. 서비스 이용 여부 확인 (사업계획서 생성 등)
    let serviceUsed = false;
    if (payment.subscription_id) {
      // 구독 시작 후 사업계획서를 생성했는지 확인
      const { data: company } = await adminSupabase
        .from("companies")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (company) {
        const { count } = await adminSupabase
          .from("business_plans")
          .select("id", { count: "exact", head: true })
          .eq("company_id", company.id)
          .gte("created_at", paidAt.toISOString());

        if (count && count > 0) {
          serviceUsed = true;
        }
      }
    }

    // 5. 자동 전액 환불 가능 여부 판단
    const autoRefundEligible = daysSincePaid <= 7 && !serviceUsed;

    // 6. 환불 요청 메타데이터 저장
    const { error: updateError } = await adminSupabase
      .from("payments")
      .update({
        metadata: {
          ...(existingMeta || {}),
          refund_requested: true,
          refund_request_reason: reason.trim(),
          refund_request_at: new Date().toISOString(),
          refund_auto_eligible: autoRefundEligible,
          days_since_paid: daysSincePaid,
          service_used: serviceUsed,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentId)
      .eq("status", "paid"); // 동시성 방지

    if (updateError) {
      return Response.json({ error: "환불 요청 처리 실패" }, { status: 500 });
    }

    if (autoRefundEligible) {
      return Response.json({
        success: true,
        autoRefund: true,
        message:
          "환불 요청이 접수되었습니다. 결제 후 7일 이내 & 서비스 미이용으로 전액 환불 대상입니다. 영업일 기준 3~5일 내 환불됩니다.",
      });
    }

    return Response.json({
      success: true,
      autoRefund: false,
      message:
        "환불 요청이 접수되었습니다. 이용 내역을 확인 후 영업일 기준 3~5일 내 결과를 안내드립니다.",
    });
  } catch (error) {
    console.error("[payments/refund] 오류:", error);
    return apiError(error, "환불 요청 실패", 500);
  }
}

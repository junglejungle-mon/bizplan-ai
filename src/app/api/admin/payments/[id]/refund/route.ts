/**
 * POST /api/admin/payments/[id]/refund
 * 관리자: 결제 환불 처리
 * - PortOne 환불 API 호출
 * - DB 결제 상태 업데이트
 * - 연결된 구독 만료 처리
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { cancelPayment } from "@/lib/payment/portone";
import { requireAdmin } from "@/lib/admin/auth";
import { apiError } from "@/lib/api/error";
import { auditLog } from "@/lib/admin/audit";
import { getClientIP } from "@/lib/utils/rate-limit";
import { validateBody, adminPaymentRefundSchema } from "@/lib/api/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const supabase = createAdminClient();
    const { id } = await params;
    const [refundBody, refundErr] = await validateBody(request, adminPaymentRefundSchema);
    if (refundErr) return refundErr;
    const reason = refundBody.reason || "관리자 환불 처리";
    const body = refundBody;

    // 1. 결제 정보 조회
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("*")
      .eq("id", id)
      .single();

    if (paymentError || !payment) {
      return Response.json({ error: "결제 정보를 찾을 수 없습니다." }, { status: 404 });
    }

    if (payment.status === "refunded") {
      return Response.json({ error: "이미 환불된 결제입니다." }, { status: 400 });
    }

    if (payment.status !== "paid") {
      return Response.json(
        { error: `결제 상태가 '${payment.status}'이므로 환불할 수 없습니다.` },
        { status: 400 }
      );
    }

    // 2. PortOne 환불 API 호출 (portone_payment_id가 있는 경우)
    let portoneRefunded = false;
    if (payment.portone_payment_id) {
      try {
        await cancelPayment(payment.portone_payment_id, reason);
        portoneRefunded = true;
      } catch (portoneError) {
        console.error("[admin/refund] PortOne 환불 실패:", portoneError);
        // PortOne 환불 실패해도 DB는 업데이트 (수동 환불인 경우)
        if (!body.forceRefund) {
          return Response.json(
            {
              error: "PortOne 환불 처리 실패. 강제 환불하려면 forceRefund: true를 전달하세요.",
              detail: portoneError instanceof Error ? portoneError.message : "Unknown error",
            },
            { status: 502 }
          );
        }
      }
    }

    // 3. DB 결제 상태 업데이트 (낙관적 잠금: status=paid 조건으로 중복 방지)
    const { data: updatedPayment, error: updateError } = await supabase
      .from("payments")
      .update({
        status: "refunded",
        metadata: {
          ...(payment.metadata as Record<string, unknown>),
          refund_reason: reason,
          refund_at: new Date().toISOString(),
          portone_refunded: portoneRefunded,
          refunded_by: "admin",
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "paid") // 동시성 환불 방지: paid 상태일 때만 업데이트
      .select()
      .single();

    if (updateError || !updatedPayment) {
      return Response.json(
        { error: "환불 처리 실패: 이미 다른 요청에 의해 처리되었거나, 상태가 변경되었습니다." },
        { status: 409 }
      );
    }

    // 4. 연결된 구독이 있으면 만료 처리
    let subscriptionExpired = false;
    if (payment.subscription_id) {
      const { error: subError } = await supabase
        .from("subscriptions")
        .update({
          status: "expired",
          canceled_at: new Date().toISOString(),
          metadata: {
            expired_reason: "refund",
            refund_payment_id: id,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.subscription_id);

      if (!subError) {
        subscriptionExpired = true;
      } else {
        console.error("[admin/refund] 구독 만료 처리 실패:", subError);
      }
    }

    await auditLog({
      action: "payment.refund",
      targetId: id,
      targetType: "payment",
      details: { reason, amount: payment.amount, portoneRefunded, subscriptionExpired },
      ip: getClientIP(request),
    });

    return Response.json({
      success: true,
      payment: updatedPayment,
      portoneRefunded,
      subscriptionExpired,
      message: `환불 완료${subscriptionExpired ? " (구독 만료 처리됨)" : ""}`,
    });
  } catch (error) {
    console.error("[admin/refund] 오류:", error);
    return apiError(error, "환불 처리 실패", 500);
  }
}

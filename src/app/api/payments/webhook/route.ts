/**
 * POST /api/payments/webhook
 * PortOne 웹훅 수신 — 인증 불요, 서명 검증
 */

import { NextRequest } from "next/server";
import { verifyWebhookSignature, getPayment, verifyPaymentAmount } from "@/lib/payment/portone";
import { updatePaymentStatus, createSubscription } from "@/lib/payment/subscription";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();

    // 서명 검증
    const webhookId = request.headers.get("webhook-id") || "";
    const webhookTimestamp = request.headers.get("webhook-timestamp") || "";
    const webhookSignature = request.headers.get("webhook-signature") || "";

    const isValid = await verifyWebhookSignature(body, {
      "webhook-id": webhookId,
      "webhook-timestamp": webhookTimestamp,
      "webhook-signature": webhookSignature,
    });

    if (!isValid) {
      console.warn("[webhook] 서명 검증 실패");
      return new Response("Invalid signature", { status: 401 });
    }

    const event = JSON.parse(body);

    switch (event.type) {
      case "Transaction.Paid": {
        await handlePaymentPaid(event.data?.paymentId);
        break;
      }
      case "Transaction.Cancelled": {
        await handlePaymentCancelled(event.data?.paymentId);
        break;
      }
      case "Transaction.Failed": {
        await handlePaymentFailed(event.data?.paymentId);
        break;
      }
      default:
        break;
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("[webhook] 오류:", error);
    // 웹훅은 200 반환해야 재시도 안 함
    return new Response("Error processed", { status: 200 });
  }
}

/**
 * 결제 완료 처리
 */
async function handlePaymentPaid(paymentId: string) {
  if (!paymentId) return;

  const adminSupabase = createAdminClient();

  // DB에서 결제 기록 확인
  const { data: paymentRecord } = await adminSupabase
    .from("payments")
    .select("*")
    .eq("portone_payment_id", paymentId)
    .single();

  if (!paymentRecord) {
    console.warn("[webhook] 결제 기록 없음:", paymentId);
    return;
  }

  // 이미 처리됨
  if (paymentRecord.status === "paid") return;

  // PortOne에서 결제 정보 조회
  const portonePayment = await getPayment(paymentId);

  // 결제 금액 검증 (DB 기록과 PortOne 실제 결제금액 비교)
  if (!verifyPaymentAmount(portonePayment, paymentRecord.amount, paymentRecord.currency || "KRW")) {
    console.error(
      "[webhook] 결제 금액 불일치!",
      `DB: ${paymentRecord.amount} ${paymentRecord.currency}`,
      `PortOne: ${portonePayment.amount.total} ${portonePayment.amount.currency}`,
      `Status: ${portonePayment.status}`
    );
    await updatePaymentStatus({
      portonePaymentId: paymentId,
      status: "failed",
      failedReason: "금액 검증 실패: DB 기록과 실제 결제 금액 불일치",
    });
    return;
  }

  const methodType = portonePayment.method?.type || "unknown";
  const easyPayProvider = portonePayment.method?.easyPay?.provider;

  // 구독이 아직 없으면 생성 (verify에서 이미 처리된 경우 스킵)
  let subscriptionId = paymentRecord.subscription_id;
  if (!subscriptionId) {
    const planId = (paymentRecord.metadata as Record<string, unknown>)?.planId as string;
    if (planId) {
      try {
        const subscription = await createSubscription({
          userId: paymentRecord.user_id,
          planId,
          portonePaymentId: paymentId,
        });
        subscriptionId = subscription.id;
        console.warn("[webhook] 구독 생성 완료:", subscriptionId);
      } catch (subError) {
        console.error("[webhook] 구독 생성 실패:", subError);
      }
    } else {
      console.warn("[webhook] metadata에 planId 없음, 구독 생성 스킵:", paymentId);
    }
  }

  await updatePaymentStatus({
    portonePaymentId: paymentId,
    status: "paid",
    paidAt: portonePayment.paidAt || new Date().toISOString(),
    paymentMethod: easyPayProvider || methodType,
    paymentMethodDetail: portonePayment.method as Record<string, unknown> || {},
    receiptUrl: portonePayment.receiptUrl || undefined,
    subscriptionId: subscriptionId || undefined,
  });

}

/**
 * 결제 취소 처리
 */
async function handlePaymentCancelled(paymentId: string) {
  if (!paymentId) return;

  await updatePaymentStatus({
    portonePaymentId: paymentId,
    status: "canceled",
  });

}

/**
 * 결제 실패 처리
 */
async function handlePaymentFailed(paymentId: string) {
  if (!paymentId) return;

  const portonePayment = await getPayment(paymentId).catch(() => null);

  await updatePaymentStatus({
    portonePaymentId: paymentId,
    status: "failed",
    failedReason: portonePayment ? `Status: ${portonePayment.status}` : "Unknown failure",
  });

}

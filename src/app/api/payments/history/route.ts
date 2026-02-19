/**
 * GET /api/payments/history
 * 사용자: 자신의 결제 이력 조회
 */

import { createClient } from "@/lib/supabase/server";
import { getUserPayments } from "@/lib/payment/subscription";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const payments = await getUserPayments(user.id, 50);

    return Response.json({
      payments: payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        payment_method: p.payment_method,
        paid_at: p.paid_at,
        created_at: p.created_at,
        receipt_url: p.receipt_url,
      })),
    });
  } catch (error) {
    console.error("[payments/history] 오류:", error);
    return Response.json({ error: "결제 이력 조회 실패" }, { status: 500 });
  }
}

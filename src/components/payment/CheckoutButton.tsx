"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { trackPaymentStart, trackPaymentComplete, trackPaymentFail } from "@/lib/analytics";

interface CheckoutButtonProps {
  planId: string;
  planName: string;
  price: number;
  className?: string;
}

export function CheckoutButton({ planId, planName, price, className }: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeRefund, setAgreeRefund] = useState(false);

  const handleCheckout = useCallback(async () => {
    if (!agreeTerms || !agreeRefund) {
      setError("결제 진행을 위해 모든 동의 항목에 체크해주세요.");
      return;
    }

    setLoading(true);
    setError(null);

    trackPaymentStart(planName, price);
    try {
      // 1. 서버에서 결제 파라미터 받기
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "결제 시작 실패");
      }

      const { checkoutParams } = await res.json();

      // 2. PortOne SDK 동적 로드 & 결제창 열기
      const PortOne = await import("@portone/browser-sdk/v2");

      const response = await PortOne.requestPayment({
        storeId: checkoutParams.storeId,
        paymentId: checkoutParams.paymentId,
        orderName: checkoutParams.orderName,
        totalAmount: checkoutParams.totalAmount,
        currency: checkoutParams.currency as "CURRENCY_KRW",
        channelKey: checkoutParams.channelKey,
        payMethod: checkoutParams.payMethod || "CARD",
        customer: checkoutParams.customer
          ? {
              customerId: checkoutParams.customer.customerId,
              fullName: checkoutParams.customer.fullName,
              email: checkoutParams.customer.email,
              phoneNumber: checkoutParams.customer.phoneNumber,
            }
          : undefined,
        redirectUrl: checkoutParams.redirectUrl,
      });

      // 3. 결제 결과 처리
      if (response?.code != null) {
        // 사용자 취소 또는 오류
        if (response.code === "FAILURE_TYPE_PG") {
          setError("결제가 실패했습니다. 다시 시도해주세요.");
        } else {
          setError(response.message || "결제가 취소되었습니다.");
        }
        return;
      }

      // 4. 서버에서 결제 검증
      const verifyRes = await fetch("/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: checkoutParams.paymentId,
          planId,
        }),
      });

      if (!verifyRes.ok) {
        const verifyData = await verifyRes.json();
        throw new Error(verifyData.error || "결제 검증 실패");
      }

      // 5. 성공 → 설정 페이지로 이동
      trackPaymentComplete(planName, price);
      window.location.href = "/settings?payment=complete";
    } catch (err) {
      console.error("결제 오류:", err);
      trackPaymentFail(planName, err instanceof Error ? err.message : "unknown");
      setError(err instanceof Error ? err.message : "결제 처리 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [planId, planName, price, agreeTerms, agreeRefund]);

  return (
    <div className={className}>
      {/* 결제 전 동의 체크박스 */}
      <div className="space-y-2 mb-3">
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={agreeTerms}
            onChange={(e) => setAgreeTerms(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-xs text-gray-600">
            <Link href="/terms" target="_blank" className="text-blue-600 underline">이용약관</Link> 및{" "}
            <Link href="/privacy" target="_blank" className="text-blue-600 underline">개인정보처리방침</Link>에
            동의합니다.
          </span>
        </label>
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={agreeRefund}
            onChange={(e) => setAgreeRefund(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-xs text-gray-600">
            월 구독 서비스이며, 결제 후 7일 이내 미이용 시 전액 환불, 이용 시 부분 환불이 가능함을 확인합니다.
          </span>
        </label>
      </div>

      <Button
        onClick={handleCheckout}
        disabled={loading || !agreeTerms || !agreeRefund}
        className="w-full"
        size="lg"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            처리 중...
          </span>
        ) : (
          `${planName} 구독하기 (${price.toLocaleString()}원/월)`
        )}
      </Button>
      {error && (
        <p className="text-red-500 text-xs mt-2 text-center">{error}</p>
      )}
    </div>
  );
}

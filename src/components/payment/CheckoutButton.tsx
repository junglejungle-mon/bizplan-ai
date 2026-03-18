"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { trackPaymentStart, trackPaymentComplete, trackPaymentFail } from "@/lib/analytics";

type PayMethod = "CARD" | "EASY_PAY" | "VIRTUAL_ACCOUNT" | "TRANSFER" | "BANK_TRANSFER";

const PAY_METHODS: { value: PayMethod | "ALL"; label: string }[] = [
  { value: "ALL", label: "전체 (결제창에서 선택)" },
  { value: "CARD", label: "신용/체크카드" },
  { value: "EASY_PAY", label: "간편결제 (카카오페이·네이버페이)" },
  { value: "VIRTUAL_ACCOUNT", label: "가상계좌" },
  { value: "TRANSFER", label: "실시간 계좌이체" },
  { value: "BANK_TRANSFER", label: "무통장입금 (직접 이체)" },
];

const BANK_INFO = {
  bank: "IBK 기업은행",
  account: "072-145703-04-027",
  holder: "(주)정글몬스터",
};

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
  const [payMethod, setPayMethod] = useState<PayMethod | "ALL">("ALL");
  const [showBankInfo, setShowBankInfo] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCheckout = useCallback(async () => {
    if (!agreeTerms || !agreeRefund) {
      setError("결제 진행을 위해 모든 동의 항목에 체크해주세요.");
      return;
    }

    // 무통장입금 선택 시 계좌 안내 표시
    if (payMethod === "BANK_TRANSFER") {
      setShowBankInfo(true);
      setError(null);
      trackPaymentStart(planName, price);
      return;
    }

    setShowBankInfo(false);
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
        payMethod: (payMethod === "CARD" || payMethod === "EASY_PAY" || payMethod === "VIRTUAL_ACCOUNT" || payMethod === "TRANSFER") ? payMethod : "CARD",
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
  }, [planId, planName, price, agreeTerms, agreeRefund, payMethod]);

  return (
    <div className={className}>
      {/* 결제수단 선택 */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-700 mb-1.5">결제수단</label>
        <select
          value={payMethod}
          onChange={(e) => setPayMethod(e.target.value as PayMethod | "ALL")}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        >
          {PAY_METHODS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

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

      {/* 무통장입금 계좌 안내 */}
      {showBankInfo && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h4 className="text-sm font-semibold text-blue-900 mb-2">무통장입금 안내</h4>
          <div className="space-y-1.5 text-sm text-blue-800">
            <p><span className="font-medium">은행:</span> {BANK_INFO.bank}</p>
            <p><span className="font-medium">계좌번호:</span> {BANK_INFO.account}</p>
            <p><span className="font-medium">예금주:</span> {BANK_INFO.holder}</p>
            <p><span className="font-medium">입금액:</span> {price.toLocaleString()}원</p>
          </div>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(BANK_INFO.account);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="mt-3 w-full rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
          >
            {copied ? "복사됨!" : "계좌번호 복사"}
          </button>
          <p className="mt-2 text-xs text-blue-600">
            입금 후 1영업일 이내에 구독이 활성화됩니다. 입금자명을 회원명과 동일하게 해주세요.
          </p>
        </div>
      )}

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

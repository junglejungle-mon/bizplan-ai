"use client";

import { useEffect, useState } from "react";
import { PricingCards } from "@/components/payment/PricingCards";
import { trackPricingView } from "@/lib/analytics";

export default function PricingPage() {
  const [currentPlan, setCurrentPlan] = useState<string>("free");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    trackPricingView();
    async function fetchCurrentPlan() {
      try {
        const res = await fetch("/api/subscriptions");
        if (res.ok) {
          const data = await res.json();
          setCurrentPlan(
            data.subscription?.plan?.name || data.usage?.planName || "free"
          );
        }
      } catch {
        // 기본값 유지
      } finally {
        setLoading(false);
      }
    }
    fetchCurrentPlan();
  }, []);

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* 헤더 */}
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">요금제</h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto">
          비즈니스에 맞는 플랜을 선택하세요.
          <br />
          모든 플랜은 14일 무료 체험을 포함합니다.
        </p>
      </div>

      {/* 플랜 카드 */}
      {!loading && <PricingCards currentPlanName={currentPlan} />}

      {/* FAQ */}
      <div className="mt-16 max-w-3xl mx-auto">
        <h2 className="text-xl font-semibold text-gray-900 mb-6 text-center">
          자주 묻는 질문
        </h2>
        <div className="space-y-4">
          {FAQ_ITEMS.map((item, i) => (
            <details
              key={i}
              className="group border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
            >
              <summary className="font-medium text-gray-900 cursor-pointer flex items-center justify-between">
                {item.q}
                <svg
                  className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </summary>
              <p className="mt-3 text-sm text-gray-600 leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
      </div>

      {/* 결제 수단 안내 */}
      <div className="mt-12 text-center">
        <p className="text-xs text-gray-400">
          결제 수단: 신용카드, 체크카드, 카카오페이, 네이버페이, 토스페이
        </p>
        <p className="text-xs text-gray-400 mt-1">
          결제는 포트원(PortOne)을 통해 안전하게 처리됩니다.
        </p>
      </div>
    </div>
  );
}

const FAQ_ITEMS = [
  {
    q: "무료 플랜으로 어디까지 사용할 수 있나요?",
    a: "무료 플랜에서는 매월 사업계획서 1건 생성, 기본 매칭 기능을 이용할 수 있습니다. 핵심 기능을 체험해보고 유료 플랜으로 업그레이드할 수 있습니다.",
  },
  {
    q: "구독을 취소하면 어떻게 되나요?",
    a: "구독 취소 시 현재 결제 기간이 끝날 때까지 모든 기능을 계속 사용할 수 있습니다. 기간 종료 후 자동으로 무료 플랜으로 전환됩니다.",
  },
  {
    q: "플랜을 변경할 수 있나요?",
    a: "언제든지 상위 플랜으로 업그레이드할 수 있습니다. 기존 결제 기간의 남은 금액은 일할 계산되어 차감됩니다.",
  },
  {
    q: "환불 정책은 어떻게 되나요?",
    a: "결제 후 7일 이내에 서비스를 사용하지 않은 경우 전액 환불이 가능합니다. 자세한 내용은 이용약관을 참고해주세요.",
  },
];

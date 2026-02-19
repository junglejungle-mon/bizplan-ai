"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckoutButton } from "./CheckoutButton";

interface Plan {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  price: number;
  currency: string;
  interval: string;
  features: string[];
  limits: Record<string, number>;
  sort_order: number;
}

interface PricingCardsProps {
  currentPlanName?: string;
}

export function PricingCards({ currentPlanName }: PricingCardsProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlans();
  }, []);

  async function fetchPlans() {
    try {
      const res = await fetch("/api/subscriptions");
      const data = await res.json();

      // 플랜 목록은 별도 API가 필요할 수 있으나, 일단 직접 조회
      const plansRes = await fetch("/api/payments/plans");
      if (plansRes.ok) {
        const plansData = await plansRes.json();
        setPlans(plansData.plans || []);
      }
    } catch (error) {
      console.error("플랜 조회 실패:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-6 bg-gray-200 rounded w-1/2" />
              <div className="h-4 bg-gray-100 rounded w-3/4 mt-2" />
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-200 rounded w-1/3 mb-4" />
              <div className="space-y-2">
                <div className="h-3 bg-gray-100 rounded" />
                <div className="h-3 bg-gray-100 rounded w-5/6" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // 플랜이 로드되지 않은 경우 하드코딩된 플레이스홀더
  const displayPlans = plans.length > 0 ? plans : getDefaultPlans();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {displayPlans.map((plan) => {
        const isCurrent = currentPlanName === plan.name;
        const isPopular = plan.name === "pro";

        return (
          <Card
            key={plan.id || plan.name}
            className={`relative flex flex-col ${
              isPopular ? "border-blue-500 border-2 shadow-lg" : ""
            }`}
          >
            {isPopular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge>추천</Badge>
              </div>
            )}

            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {plan.display_name}
                {isCurrent && (
                  <Badge variant="success">현재 플랜</Badge>
                )}
              </CardTitle>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>

            <CardContent className="flex-1">
              <div className="mb-6">
                {plan.price === 0 ? (
                  <div className="text-3xl font-bold text-gray-900">
                    무료
                  </div>
                ) : (
                  <div>
                    <span className="text-3xl font-bold text-gray-900">
                      {plan.price.toLocaleString()}
                    </span>
                    <span className="text-gray-500 text-sm ml-1">
                      원/{plan.interval === "month" ? "월" : plan.interval}
                    </span>
                  </div>
                )}
              </div>

              <ul className="space-y-3">
                {(plan.features as string[]).map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <svg
                      className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>

            <CardFooter>
              {isCurrent ? (
                <button
                  disabled
                  className="w-full py-2.5 px-4 rounded-lg bg-gray-100 text-gray-400 text-sm font-medium cursor-not-allowed"
                >
                  현재 플랜
                </button>
              ) : plan.price === 0 ? (
                <button
                  disabled
                  className="w-full py-2.5 px-4 rounded-lg bg-gray-100 text-gray-500 text-sm font-medium cursor-not-allowed"
                >
                  기본 포함
                </button>
              ) : (
                <CheckoutButton
                  planId={plan.id}
                  planName={plan.display_name}
                  price={plan.price}
                  className="w-full"
                />
              )}
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}

function getDefaultPlans(): Plan[] {
  return [
    {
      id: "free",
      name: "free",
      display_name: "무료",
      description: "서비스 체험",
      price: 0,
      currency: "KRW",
      interval: "month",
      features: ["사업계획서 1건/월", "기본 AI 매칭", "섹션 재생성 3회"],
      limits: { plan_generations: 1, section_regenerations: 3, ir_generations: 0, exports: 1 },
      sort_order: 0,
    },
    {
      id: "pro",
      name: "pro",
      display_name: "프로",
      description: "사업자 필수 플랜",
      price: 99000,
      currency: "KRW",
      interval: "month",
      features: ["사업계획서 10건/월", "IR PPT 5건/월", "섹션 재생성 50회", "리서치 강화", "우선 처리"],
      limits: { plan_generations: 10, section_regenerations: 50, ir_generations: 5, exports: 20 },
      sort_order: 1,
    },
    {
      id: "allfree",
      name: "allfree",
      display_name: "올프리",
      description: "무제한 사용",
      price: 299000,
      currency: "KRW",
      interval: "month",
      features: ["무제한 사업계획서", "무제한 IR PPT", "무제한 재생성", "리서치 강화", "전담 지원"],
      limits: { plan_generations: -1, section_regenerations: -1, ir_generations: -1, exports: -1 },
      sort_order: 2,
    },
  ];
}

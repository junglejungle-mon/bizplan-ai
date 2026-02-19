"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface SubscriptionData {
  id: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: string;
  currentPeriodEnd: string | null;
  plan: {
    id: string;
    name: string;
    displayName: string;
    price: number;
    features: string[];
    limits: Record<string, number>;
  };
}

interface UsageData {
  period: string;
  usage: Record<string, number>;
  limits: Record<string, number>;
  planName: string;
  planDisplayName: string;
}

const USAGE_LABELS: Record<string, string> = {
  plan_generations: "사업계획서",
  section_regenerations: "섹션 재생성",
  ir_generations: "IR 발표자료",
  exports: "내보내기",
};

export function SubscriptionStatus() {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [canceling, setCanceling] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const res = await fetch("/api/subscriptions");
      if (res.ok) {
        const data = await res.json();
        setSubscription(data.subscription);
        setUsage(data.usage);
      }
    } catch (error) {
      console.error("구독 정보 조회 실패:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleCancel = useCallback(async () => {
    if (!confirm("구독을 취소하시겠습니까?\n현재 구독 기간이 끝날 때까지 사용할 수 있습니다.")) {
      return;
    }

    setCanceling(true);
    try {
      const res = await fetch("/api/subscriptions/cancel", { method: "POST" });
      const data = await res.json();

      if (res.ok) {
        toast.success(data.message || "구독이 취소되었습니다.");
        fetchData(); // 새로고침
      } else {
        toast.error(data.error || "구독 취소 실패");
      }
    } catch {
      toast.error("구독 취소 중 오류가 발생했습니다.");
    } finally {
      setCanceling(false);
    }
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>구독 관리</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-6 bg-gray-200 rounded w-1/3" />
            <div className="h-4 bg-gray-100 rounded w-1/2" />
            <div className="h-4 bg-gray-100 rounded w-2/3" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const planName = subscription?.plan?.displayName || usage?.planDisplayName || "무료";
  const planPrice = subscription?.plan?.price || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>구독 관리</span>
          <Badge
            variant={subscription?.status === "active" ? "success" : "secondary"}
          >
            {planName}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* 플랜 정보 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">현재 플랜</span>
            <span className="text-sm font-medium">
              {planPrice > 0
                ? `${planPrice.toLocaleString()}원/월`
                : "무료"}
            </span>
          </div>

          {subscription?.currentPeriodEnd && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">
                {subscription.cancelAtPeriodEnd ? "만료 예정일" : "다음 결제일"}
              </span>
              <span className="text-sm">
                {new Date(subscription.currentPeriodEnd).toLocaleDateString("ko-KR")}
              </span>
            </div>
          )}

          {subscription?.cancelAtPeriodEnd && (
            <div className="mt-2 p-2 bg-yellow-50 rounded-lg">
              <p className="text-xs text-yellow-700">
                구독이 기간 종료 시 만료됩니다.
              </p>
            </div>
          )}
        </div>

        {/* 사용량 */}
        {usage && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              이번 달 사용량 ({usage.period})
            </h4>
            <div className="space-y-3">
              {Object.entries(USAGE_LABELS).map(([key, label]) => {
                const current = usage.usage[key] || 0;
                const limit = usage.limits[key] || 0;
                const isUnlimited = limit === -1;
                const percentage = isUnlimited
                  ? 0
                  : limit > 0
                  ? Math.min(100, (current / limit) * 100)
                  : 0;

                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-500">{label}</span>
                      <span className="text-xs font-medium">
                        {current} / {isUnlimited ? "무제한" : limit}
                      </span>
                    </div>
                    {!isUnlimited && (
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${
                            percentage >= 90
                              ? "bg-red-500"
                              : percentage >= 70
                              ? "bg-yellow-500"
                              : "bg-blue-500"
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => (window.location.href = "/pricing")}
            className="flex-1"
          >
            {planPrice > 0 ? "플랜 변경" : "업그레이드"}
          </Button>
          {subscription && planPrice > 0 && !subscription.cancelAtPeriodEnd && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={canceling}
              className="text-red-500 hover:text-red-600 hover:bg-red-50"
            >
              {canceling ? "처리 중..." : "구독 취소"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import { Fragment, useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// ── Types ──

interface Payment {
  id: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  subscription_id: string | null;
  amount: number;
  currency: string;
  status: string;
  portone_payment_id: string | null;
  payment_method: string | null;
  paid_at: string | null;
  failed_reason: string | null;
  receipt_url: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
}

interface Subscription {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: string;
  currentPeriodEnd: string | null;
  canceledAt: string | null;
  createdAt: string;
  plan: {
    id: string;
    name: string;
    displayName: string;
    price: number;
  } | null;
}

interface PlanOption {
  id: string;
  name: string;
  display_name: string;
  price: number;
}

type TabType = "payments" | "subscriptions";

const STATUS_BADGE: Record<
  string,
  { label: string; variant: "success" | "warning" | "destructive" | "secondary" | "default" }
> = {
  paid: { label: "완료", variant: "success" },
  pending: { label: "대기", variant: "warning" },
  failed: { label: "실패", variant: "destructive" },
  canceled: { label: "취소", variant: "secondary" },
  refunded: { label: "환불", variant: "default" },
  active: { label: "활성", variant: "success" },
  trialing: { label: "체험", variant: "default" },
  past_due: { label: "연체", variant: "destructive" },
  expired: { label: "만료", variant: "secondary" },
};

const STATUS_FILTERS = {
  payments: [
    { value: "", label: "전체" },
    { value: "paid", label: "완료" },
    { value: "pending", label: "대기" },
    { value: "refunded", label: "환불" },
    { value: "failed", label: "실패" },
    { value: "canceled", label: "취소" },
  ],
  subscriptions: [
    { value: "", label: "전체" },
    { value: "active", label: "활성" },
    { value: "trialing", label: "체험" },
    { value: "canceled", label: "취소" },
    { value: "expired", label: "만료" },
  ],
};

// ── Main Page ──

export default function AdminPaymentsPage() {
  const [tab, setTab] = useState<TabType>("payments");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentsTotal, setPaymentsTotal] = useState(0);
  const [subsTotal, setSubsTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [plans, setPlans] = useState<PlanOption[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const statusParam = statusFilter ? `&status=${statusFilter}` : "";
      if (tab === "payments") {
        const res = await fetch(`/api/admin/payments?limit=50${statusParam}`);
        if (res.ok) {
          const data = await res.json();
          setPayments(data.payments || []);
          setPaymentsTotal(data.total || 0);
        }
      } else {
        const res = await fetch(`/api/admin/subscriptions?limit=50${statusParam}`);
        if (res.ok) {
          const data = await res.json();
          setSubscriptions(data.subscriptions || []);
          setSubsTotal(data.total || 0);
        }
      }
    } catch (error) {
      console.error("데이터 조회 실패:", error);
    } finally {
      setLoading(false);
    }
  }, [tab, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 플랜 목록 조회 (구독 탭에서 플랜 변경용)
  useEffect(() => {
    async function fetchPlans() {
      try {
        const res = await fetch("/api/subscriptions");
        if (res.ok) {
          const data = await res.json();
          if (data.plans) setPlans(data.plans);
        }
      } catch {
        // ignore
      }
    }
    fetchPlans();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">결제 관리</h1>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>결제 {paymentsTotal}건</span>
          <span>|</span>
          <span>구독 {subsTotal}건</span>
        </div>
      </div>

      {/* 탭 + 필터 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          <button
            onClick={() => {
              setTab("payments");
              setStatusFilter("");
            }}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === "payments"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            결제 내역
          </button>
          <button
            onClick={() => {
              setTab("subscriptions");
              setStatusFilter("");
            }}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === "subscriptions"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            구독 현황
          </button>
        </div>

        {/* 상태 필터 */}
        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTERS[tab].map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                statusFilter === f.value
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-50 text-gray-500 hover:bg-gray-100"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 콘텐츠 */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto" />
              <p className="mt-2 text-sm text-gray-500">로딩 중...</p>
            </div>
          ) : tab === "payments" ? (
            <PaymentsTable payments={payments} onRefresh={fetchData} />
          ) : (
            <SubscriptionsTable
              subscriptions={subscriptions}
              plans={plans}
              onRefresh={fetchData}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Payments Table ──

function PaymentsTable({
  payments,
  onRefresh,
}: {
  payments: Payment[];
  onRefresh: () => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refunding, setRefunding] = useState<string | null>(null);
  const [refundReason, setRefundReason] = useState("");

  async function handleRefund(payment: Payment) {
    if (!refundReason.trim()) {
      toast.warning("환불 사유를 입력해주세요.");
      return;
    }

    if (!confirm(`${payment.amount.toLocaleString()}원 환불을 진행하시겠습니까?`)) return;

    setRefunding(payment.id);
    try {
      const res = await fetch(`/api/admin/payments/${payment.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: refundReason }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "환불 완료");
        setExpandedId(null);
        setRefundReason("");
        onRefresh();
      } else {
        toast.error(`환불 실패: ${data.error}`);
      }
    } catch (error) {
      toast.error("환불 요청 중 오류가 발생했습니다.");
      console.error(error);
    } finally {
      setRefunding(null);
    }
  }

  if (payments.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-sm">결제 내역이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[700px]">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left py-3 px-4 font-medium text-gray-500">사용자</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">결제수단</th>
            <th className="text-right py-3 px-4 font-medium text-gray-500">금액</th>
            <th className="text-center py-3 px-4 font-medium text-gray-500">상태</th>
            <th className="text-right py-3 px-4 font-medium text-gray-500">일시</th>
            <th className="text-center py-3 px-4 font-medium text-gray-500">관리</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {payments.map((p) => {
            const statusInfo = STATUS_BADGE[p.status] || {
              label: p.status,
              variant: "secondary" as const,
            };
            const isExpanded = expandedId === p.id;
            return (
              <Fragment key={p.id}>
                <tr
                  className={`hover:bg-gray-50 cursor-pointer ${isExpanded ? "bg-blue-50/50" : ""}`}
                  onClick={() => {
                    setExpandedId(isExpanded ? null : p.id);
                    setRefundReason("");
                  }}
                >
                  <td className="py-3 px-4">
                    <div className="font-medium text-gray-900 text-xs">
                      {p.user_name || "이름 없음"}
                    </div>
                    <div className="text-xs text-gray-400">
                      {p.user_email || p.user_id.slice(0, 8)}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-gray-600">{p.payment_method || "-"}</td>
                  <td className="py-3 px-4 text-right font-medium text-gray-900">
                    {p.amount.toLocaleString()}원
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                  </td>
                  <td className="py-3 px-4 text-right text-gray-500 text-xs">
                    {p.paid_at
                      ? new Date(p.paid_at).toLocaleString("ko-KR")
                      : new Date(p.created_at).toLocaleString("ko-KR")}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {p.status === "paid" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedId(isExpanded ? null : p.id);
                          setRefundReason("");
                        }}
                      >
                        환불
                      </Button>
                    )}
                    {p.receipt_url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 ml-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(p.receipt_url!, "_blank");
                        }}
                      >
                        영수증
                      </Button>
                    )}
                  </td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={6} className="px-4 pb-4 bg-gray-50/80">
                      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                        <div>
                          <span className="text-gray-400">결제 ID</span>
                          <p className="font-mono text-gray-600 mt-0.5 break-all">
                            {p.portone_payment_id || p.id}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-400">구독 ID</span>
                          <p className="font-mono text-gray-600 mt-0.5">
                            {p.subscription_id?.slice(0, 8) || "-"}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-400">생성일</span>
                          <p className="text-gray-600 mt-0.5">
                            {new Date(p.created_at).toLocaleString("ko-KR")}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-400">실패 사유</span>
                          <p className="text-gray-600 mt-0.5">{p.failed_reason || "-"}</p>
                        </div>
                      </div>

                      {/* 환불 패널 */}
                      {p.status === "paid" && (
                        <div className="mt-4 p-3 bg-white rounded-lg border border-red-200">
                          <h4 className="font-medium text-red-700 mb-2 text-sm">환불 처리</h4>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="환불 사유를 입력하세요"
                              value={refundReason}
                              onChange={(e) => setRefundReason(e.target.value)}
                              className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={refunding === p.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRefund(p);
                              }}
                            >
                              {refunding === p.id
                                ? "처리 중..."
                                : `${p.amount.toLocaleString()}원 환불`}
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* 환불 정보 표시 */}
                      {p.status === "refunded" && p.metadata && (() => {
                        const meta = p.metadata as Record<string, unknown>;
                        const reason = meta.refund_reason ? String(meta.refund_reason) : "-";
                        const refundAt = meta.refund_at ? String(meta.refund_at) : null;
                        return (
                          <div className="mt-3 p-3 bg-gray-100 rounded-lg text-xs">
                            <span className="text-gray-400">환불 사유: </span>
                            <span className="text-gray-600">{reason}</span>
                            {refundAt && (
                              <>
                                <span className="text-gray-400 ml-3">환불일: </span>
                                <span className="text-gray-600">
                                  {new Date(refundAt).toLocaleString("ko-KR")}
                                </span>
                              </>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Subscriptions Table ──

function SubscriptionsTable({
  subscriptions,
  plans,
  onRefresh,
}: {
  subscriptions: Subscription[];
  plans: PlanOption[];
  onRefresh: () => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [changePlanId, setChangePlanId] = useState<string>("");
  const [extendDays, setExtendDays] = useState<number>(30);

  async function handleForceCancel(sub: Subscription) {
    if (!confirm(`${sub.userName || sub.userId}님의 구독을 강제 취소하시겠습니까?`)) return;

    setActionLoading(sub.id);
    try {
      const res = await fetch(`/api/admin/subscriptions/${sub.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "구독 강제 취소 완료");
        setExpandedId(null);
        onRefresh();
      } else {
        toast.error(`실패: ${data.error}`);
      }
    } catch {
      toast.error("요청 중 오류 발생");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleChangePlan(sub: Subscription) {
    if (!changePlanId) {
      toast.warning("변경할 플랜을 선택하세요.");
      return;
    }
    if (!confirm("플랜을 변경하시겠습니까?")) return;

    setActionLoading(sub.id);
    try {
      const res = await fetch(`/api/admin/subscriptions/${sub.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: changePlanId }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("플랜 변경 완료");
        setExpandedId(null);
        setChangePlanId("");
        onRefresh();
      } else {
        toast.error(`실패: ${data.error}`);
      }
    } catch {
      toast.error("요청 중 오류 발생");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleExtend(sub: Subscription) {
    if (extendDays <= 0) {
      toast.warning("연장 일수를 입력하세요.");
      return;
    }
    if (!confirm(`구독을 ${extendDays}일 연장하시겠습니까?`)) return;

    setActionLoading(sub.id);
    try {
      const currentEnd = sub.currentPeriodEnd
        ? new Date(sub.currentPeriodEnd)
        : new Date();
      currentEnd.setDate(currentEnd.getDate() + extendDays);

      const res = await fetch(`/api/admin/subscriptions/${sub.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_period_end: currentEnd.toISOString(),
          status: "active",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`구독 ${extendDays}일 연장 완료`);
        setExpandedId(null);
        onRefresh();
      } else {
        toast.error(`실패: ${data.error}`);
      }
    } catch {
      toast.error("요청 중 오류 발생");
    } finally {
      setActionLoading(null);
    }
  }

  if (subscriptions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-sm">구독 내역이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[700px]">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left py-3 px-4 font-medium text-gray-500">사용자</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">플랜</th>
            <th className="text-right py-3 px-4 font-medium text-gray-500">금액</th>
            <th className="text-center py-3 px-4 font-medium text-gray-500">상태</th>
            <th className="text-right py-3 px-4 font-medium text-gray-500">만료일</th>
            <th className="text-center py-3 px-4 font-medium text-gray-500">관리</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {subscriptions.map((s) => {
            const statusInfo = STATUS_BADGE[s.status] || {
              label: s.status,
              variant: "secondary" as const,
            };
            const isExpanded = expandedId === s.id;
            const isActive = s.status === "active" || s.status === "trialing";
            return (
              <Fragment key={s.id}>
                <tr
                  className={`hover:bg-gray-50 cursor-pointer ${
                    isExpanded ? "bg-blue-50/50" : ""
                  }`}
                  onClick={() => setExpandedId(isExpanded ? null : s.id)}
                >
                  <td className="py-3 px-4">
                    <div className="font-medium text-gray-900 text-xs">
                      {s.userName || "이름 없음"}
                    </div>
                    <div className="text-xs text-gray-400">
                      {s.userEmail || s.userId.slice(0, 8)}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-gray-900 font-medium">
                    {s.plan?.displayName || "-"}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-600">
                    {s.plan?.price ? `${s.plan.price.toLocaleString()}원/월` : "-"}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Badge variant={statusInfo.variant}>
                      {statusInfo.label}
                      {s.cancelAtPeriodEnd && " (취소예정)"}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-right text-gray-500 text-xs">
                    {s.currentPeriodEnd
                      ? new Date(s.currentPeriodEnd).toLocaleDateString("ko-KR")
                      : "-"}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {isActive && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedId(isExpanded ? null : s.id);
                        }}
                      >
                        관리
                      </Button>
                    )}
                  </td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={6} className="px-4 pb-4 bg-gray-50/80">
                      {/* 상세 정보 */}
                      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                        <div>
                          <span className="text-gray-400">구독 ID</span>
                          <p className="font-mono text-gray-600 mt-0.5">
                            {s.id.slice(0, 12)}...
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-400">시작일</span>
                          <p className="text-gray-600 mt-0.5">
                            {new Date(s.currentPeriodStart).toLocaleDateString("ko-KR")}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-400">가입일</span>
                          <p className="text-gray-600 mt-0.5">
                            {new Date(s.createdAt).toLocaleDateString("ko-KR")}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-400">취소일</span>
                          <p className="text-gray-600 mt-0.5">
                            {s.canceledAt
                              ? new Date(s.canceledAt).toLocaleDateString("ko-KR")
                              : "-"}
                          </p>
                        </div>
                      </div>

                      {/* 관리 액션 패널 (활성 구독만) */}
                      {isActive && (
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                          {/* 플랜 변경 */}
                          <div className="p-3 bg-white rounded-lg border border-blue-200">
                            <h4 className="font-medium text-blue-700 mb-2 text-sm">
                              플랜 변경
                            </h4>
                            <select
                              value={changePlanId}
                              onChange={(e) => setChangePlanId(e.target.value)}
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md mb-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <option value="">플랜 선택</option>
                              {plans
                                .filter((p) => p.id !== s.plan?.id)
                                .map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.display_name} ({p.price.toLocaleString()}원)
                                  </option>
                                ))}
                            </select>
                            <Button
                              size="sm"
                              className="w-full text-xs"
                              disabled={actionLoading === s.id || !changePlanId}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleChangePlan(s);
                              }}
                            >
                              {actionLoading === s.id ? "처리 중..." : "변경"}
                            </Button>
                          </div>

                          {/* 기간 연장 */}
                          <div className="p-3 bg-white rounded-lg border border-green-200">
                            <h4 className="font-medium text-green-700 mb-2 text-sm">
                              기간 연장
                            </h4>
                            <div className="flex gap-2 mb-2">
                              <input
                                type="number"
                                min={1}
                                max={365}
                                value={extendDays}
                                onChange={(e) =>
                                  setExtendDays(parseInt(e.target.value) || 0)
                                }
                                className="w-20 px-2 py-1.5 text-sm border border-gray-300 rounded-md"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <span className="text-sm text-gray-500 self-center">일</span>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full text-xs border-green-300 text-green-700 hover:bg-green-50"
                              disabled={actionLoading === s.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleExtend(s);
                              }}
                            >
                              {actionLoading === s.id ? "처리 중..." : `${extendDays}일 연장`}
                            </Button>
                          </div>

                          {/* 강제 취소 */}
                          <div className="p-3 bg-white rounded-lg border border-red-200">
                            <h4 className="font-medium text-red-700 mb-2 text-sm">
                              강제 취소
                            </h4>
                            <p className="text-xs text-gray-500 mb-2">
                              구독을 즉시 만료 처리합니다. 환불은 별도 처리해야 합니다.
                            </p>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="w-full text-xs"
                              disabled={actionLoading === s.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleForceCancel(s);
                              }}
                            >
                              {actionLoading === s.id ? "처리 중..." : "즉시 취소"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

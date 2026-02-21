"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { UserGrowthChart } from "@/components/admin/user-growth-chart";

interface RecentPayment {
  id: string;
  amount: number;
  status: string;
  payment_method: string | null;
  created_at: string;
}

interface Stats {
  companies: number;
  plans: number;
  programs: number;
  activePrograms: number;
  matchings: number;
  references: number;
  chunks: number;
  profiles: number;
  avgQualityScore: number | null;
  activeSubscriptions: number;
  totalRevenue: number;
  monthlyRevenue: number;
  recentPlans: Array<{ id: string; title: string; status: string; created_at: string }>;
  recentUsers: Array<{ id: string; full_name: string; email: string; created_at: string }>;
  recentPayments: RecentPayment[];
  // 핵심 지표 (W08 KPI)
  dau: number;
  wau: number;
  retention7d: number;
  interviewCompletionRate: number;
  // 운영 통계
  notificationsSent: number;
  notificationsFailed: number;
  documentsUploaded: number;
  documentsExtracted: number;
}

const STATUS_LABEL: Record<string, { text: string; variant: "success" | "warning" | "destructive" | "secondary" }> = {
  paid: { text: "완료", variant: "success" },
  pending: { text: "대기", variant: "warning" },
  failed: { text: "실패", variant: "destructive" },
  canceled: { text: "취소", variant: "secondary" },
  refunded: { text: "환불", variant: "secondary" },
};

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/dashboard/stats");
      if (!r.ok) throw new Error(`서버 오류 (${r.status})`);
      const data = await r.json();
      setStats(data);
    } catch (err) {
      console.error("대시보드 통계 조회 실패:", err);
      setError(err instanceof Error ? err.message : "데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    // 30초마다 자동 갱신
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="text-center py-12 text-gray-400">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto" />
        <p className="mt-2 text-sm">로딩 중...</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="text-center py-12">
        <div className="text-red-400 mb-2">
          <svg className="h-10 w-10 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <p className="text-sm text-gray-500 mb-3">{error || "데이터를 불러올 수 없습니다"}</p>
        <button
          onClick={fetchStats}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          다시 시도
        </button>
      </div>
    );
  }

  const kpis = [
    { label: "사용자", value: stats.profiles, sub: `${stats.companies}개 기업`, color: "bg-blue-500" },
    { label: "사업계획서", value: stats.plans, sub: stats.avgQualityScore ? `평균 ${stats.avgQualityScore}점` : "채점 대기", color: "bg-green-500" },
    { label: "프로그램", value: (stats.programs ?? 0).toLocaleString(), sub: `${stats.activePrograms || 0}개 활성`, color: "bg-purple-500" },
    { label: "매칭", value: stats.matchings, sub: "기업-프로그램", color: "bg-orange-500" },
    { label: "레퍼런스", value: stats.references, sub: `${stats.chunks} 청크`, color: "bg-pink-500" },
  ];

  // W08 핵심 KPI 지표 (목표: DAU 5, 리텐션 20%, 인터뷰완료 60%)
  const coreKpis = [
    {
      label: "DAU",
      value: stats.dau,
      target: 5,
      sub: "일일 활성 사용자",
      color: stats.dau >= 5 ? "bg-green-500" : "bg-red-500",
      targetLabel: "목표 5",
    },
    {
      label: "WAU",
      value: stats.wau,
      target: null,
      sub: "주간 활성 사용자",
      color: "bg-blue-500",
      targetLabel: null,
    },
    {
      label: "7일 리텐션",
      value: `${stats.retention7d}%`,
      target: 20,
      sub: "가입 후 재방문율",
      color: stats.retention7d >= 20 ? "bg-green-500" : "bg-red-500",
      targetLabel: "목표 20%",
    },
    {
      label: "인터뷰 완료율",
      value: `${stats.interviewCompletionRate}%`,
      target: 60,
      sub: "5라운드 완주",
      color: stats.interviewCompletionRate >= 60 ? "bg-green-500" : "bg-red-500",
      targetLabel: "목표 60%",
    },
  ];

  const revenueKpis = [
    { label: "활성 구독", value: stats.activeSubscriptions, sub: "유료 사용자", color: "bg-indigo-500" },
    { label: "이번달 매출", value: `${(stats.monthlyRevenue || 0).toLocaleString()}원`, sub: new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long" }), color: "bg-emerald-500" },
    { label: "총 매출", value: `${(stats.totalRevenue || 0).toLocaleString()}원`, sub: "누적", color: "bg-amber-500" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">대시보드</h1>

      {/* 핵심 KPI (W08 목표) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {coreKpis.map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-5 relative overflow-hidden">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-2 h-2 rounded-full ${kpi.color}`} />
              <span className="text-xs text-gray-500 font-medium">{kpi.label}</span>
              {kpi.targetLabel && (
                <span className="text-[10px] text-gray-400 ml-auto">{kpi.targetLabel}</span>
              )}
            </div>
            <div className="text-2xl font-bold text-gray-900">{kpi.value}</div>
            <div className="text-xs text-gray-400 mt-1">{kpi.sub}</div>
            {kpi.target != null && (
              <div className="mt-2">
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${kpi.color}`}
                    style={{ width: `${Math.min(100, (typeof kpi.value === 'number' ? kpi.value : parseFloat(String(kpi.value))) / kpi.target * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 서비스 KPI 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-2 h-2 rounded-full ${kpi.color}`} />
              <span className="text-xs text-gray-500">{kpi.label}</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{kpi.value}</div>
            <div className="text-xs text-gray-400 mt-1">{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* 매출 KPI 카드 */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {revenueKpis.map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-2 h-2 rounded-full ${kpi.color}`} />
              <span className="text-xs text-gray-500">{kpi.label}</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{kpi.value}</div>
            <div className="text-xs text-gray-400 mt-1">{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* 운영 KPI 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "서류 업로드", value: stats.documentsUploaded ?? 0, sub: `${stats.documentsExtracted ?? 0}건 분석완료`, color: "bg-cyan-500" },
          { label: "알림 발송", value: stats.notificationsSent ?? 0, sub: `${stats.notificationsFailed ?? 0}건 실패`, color: "bg-rose-500" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-2 h-2 rounded-full ${kpi.color}`} />
              <span className="text-xs text-gray-500">{kpi.label}</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{kpi.value}</div>
            <div className="text-xs text-gray-400 mt-1">{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* 차트 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <RevenueChart />
        <UserGrowthChart />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 최근 사업계획서 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">최근 사업계획서</h2>
            <Link href="/admin/quality" className="text-xs text-blue-600 hover:underline">전체 보기</Link>
          </div>
          {stats.recentPlans?.length === 0 ? (
            <p className="text-sm text-gray-400">아직 없음</p>
          ) : (
            <div className="space-y-3">
              {stats.recentPlans?.map((plan) => (
                <div key={plan.id} className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-700 truncate max-w-[200px]">{plan.title}</div>
                    <div className="text-xs text-gray-400">{new Date(plan.created_at).toLocaleDateString("ko-KR")}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    plan.status === "completed" ? "bg-green-100 text-green-700" :
                    plan.status === "generating" ? "bg-yellow-100 text-yellow-700" :
                    "bg-gray-100 text-gray-700"
                  }`}>{plan.status === "completed" ? "완성" : plan.status === "generating" ? "생성중" : "초안"}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 최근 가입 사용자 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">최근 가입 사용자</h2>
            <Link href="/admin/users" className="text-xs text-blue-600 hover:underline">전체 보기</Link>
          </div>
          {stats.recentUsers?.length === 0 ? (
            <p className="text-sm text-gray-400">아직 없음</p>
          ) : (
            <div className="space-y-3">
              {stats.recentUsers?.map((user) => (
                <div key={user.id} className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-700">{user.full_name || "이름 미설정"}</div>
                    <div className="text-xs text-gray-400">{user.email}</div>
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(user.created_at).toLocaleDateString("ko-KR")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 최근 결제 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">최근 결제</h2>
            <Link href="/admin/payments" className="text-xs text-blue-600 hover:underline">전체 보기</Link>
          </div>
          {!stats.recentPayments || stats.recentPayments.length === 0 ? (
            <p className="text-sm text-gray-400">아직 없음</p>
          ) : (
            <div className="space-y-3">
              {stats.recentPayments.map((payment) => {
                const statusInfo = STATUS_LABEL[payment.status] || { text: payment.status, variant: "secondary" as const };
                return (
                  <div key={payment.id} className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-700">
                        {payment.amount.toLocaleString()}원
                      </div>
                      <div className="text-xs text-gray-400">
                        {payment.payment_method || "-"} | {new Date(payment.created_at).toLocaleDateString("ko-KR")}
                      </div>
                    </div>
                    <Badge variant={statusInfo.variant} className="text-[10px]">
                      {statusInfo.text}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

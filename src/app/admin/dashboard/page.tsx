"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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
  recentPlans: Array<{ id: string; title: string; status: string; created_at: string }>;
  recentUsers: Array<{ id: string; full_name: string; email: string; created_at: string }>;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/dashboard/stats")
      .then((r) => r.json())
      .then((data) => setStats(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-center py-12 text-gray-400">로딩 중...</div>;
  }

  if (!stats) {
    return <div className="text-center py-12 text-gray-400">데이터를 불러올 수 없습니다</div>;
  }

  const kpis = [
    { label: "사용자", value: stats.profiles, sub: `${stats.companies}개 기업`, color: "bg-blue-500" },
    { label: "사업계획서", value: stats.plans, sub: stats.avgQualityScore ? `평균 ${stats.avgQualityScore}점` : "채점 대기", color: "bg-green-500" },
    { label: "프로그램", value: stats.programs.toLocaleString(), sub: `${stats.activePrograms || 0}개 활성`, color: "bg-purple-500" },
    { label: "매칭", value: stats.matchings, sub: "기업-프로그램", color: "bg-orange-500" },
    { label: "레퍼런스", value: stats.references, sub: `${stats.chunks} 청크`, color: "bg-pink-500" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">대시보드</h1>

      {/* KPI 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                    <div className="text-sm font-medium text-gray-700 truncate max-w-[240px]">{plan.title}</div>
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
      </div>
    </div>
  );
}

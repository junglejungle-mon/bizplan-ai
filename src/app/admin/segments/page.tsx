"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface SegmentUser {
  id: string;
  name: string | null;
  email: string;
  created_at: string;
  plan: string | null;
  planCount: number;
  profileScore: number;
  lastActivity: string | null;
}

interface Summary {
  totalUsers: number;
  planDistribution: Record<string, number>;
  activityDistribution: Record<string, number>;
  joinDistribution: Record<string, number>;
  profileDistribution: Record<string, number>;
}

interface Segments {
  byPlan: Record<string, SegmentUser[]>;
  byActivity: Record<string, SegmentUser[]>;
  byJoinDate: Record<string, SegmentUser[]>;
  byProfile: Record<string, SegmentUser[]>;
}

type ViewMode = "plan" | "activity" | "join" | "profile";

const VIEW_LABELS: Record<ViewMode, string> = {
  plan: "플랜별",
  activity: "활동별",
  join: "가입 시기별",
  profile: "프로필 완성도별",
};

const PLAN_COLORS: Record<string, string> = {
  "무료": "bg-gray-100 text-gray-700",
  "프로": "bg-purple-100 text-purple-700",
  "올프리": "bg-amber-100 text-amber-700",
};

const ACTIVITY_COLORS: Record<string, string> = {
  "활발": "bg-green-100 text-green-700",
  "보통": "bg-yellow-100 text-yellow-700",
  "비활성": "bg-red-100 text-red-700",
};

export default function AdminSegmentsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [segments, setSegments] = useState<Segments | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("plan");
  const [expandedSegment, setExpandedSegment] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/segments");
        if (res.ok) {
          const data = await res.json();
          setSummary(data.summary);
          setSegments(data.segments);
        }
      } catch (error) {
        console.error("세그먼트 조회 실패:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!summary || !segments) {
    return <div className="text-center py-12 text-gray-500">데이터를 불러올 수 없습니다.</div>;
  }

  // 현재 뷰에 맞는 분포 데이터
  const distributionData = {
    plan: summary.planDistribution,
    activity: summary.activityDistribution,
    join: summary.joinDistribution,
    profile: summary.profileDistribution,
  }[viewMode];

  const segmentData = {
    plan: segments.byPlan,
    activity: segments.byActivity,
    join: segments.byJoinDate,
    profile: segments.byProfile,
  }[viewMode];

  const segmentLabels: Record<ViewMode, Record<string, string>> = {
    plan: { free: "무료", pro: "프로", allfree: "올프리" },
    activity: { active: "활발", moderate: "보통", inactive: "비활성" },
    join: { recent7d: "최근 7일", recent30d: "최근 30일", older90d: "30~90일", veteran: "90일+" },
    profile: { high: "높음 (70%+)", medium: "보통 (30~70%)", low: "낮음 (<30%)" },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">고객 세그먼테이션</h1>
          <p className="text-sm text-gray-500 mt-1">전체 {summary.totalUsers}명</p>
        </div>
      </div>

      {/* 뷰 모드 전환 */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(Object.keys(VIEW_LABELS) as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => { setViewMode(mode); setExpandedSegment(null); }}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === mode ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {VIEW_LABELS[mode]}
          </button>
        ))}
      </div>

      {/* 분포 차트 (바 형태) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{VIEW_LABELS[viewMode]} 분포</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(distributionData).map(([label, count]) => {
              const pct = summary.totalUsers > 0 ? (count / summary.totalUsers) * 100 : 0;
              return (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">{label}</span>
                    <span className="text-sm text-gray-500">{count}명 ({pct.toFixed(1)}%)</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${Math.max(pct, 0.5)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 세그먼트 상세 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(segmentData).map(([key, users]) => {
          const label = segmentLabels[viewMode][key] || key;
          const isExpanded = expandedSegment === key;
          const colorClass = viewMode === "plan"
            ? (PLAN_COLORS[label] || "bg-gray-100 text-gray-700")
            : viewMode === "activity"
              ? (ACTIVITY_COLORS[label] || "bg-gray-100 text-gray-700")
              : "bg-gray-100 text-gray-700";

          return (
            <Card
              key={key}
              className={`cursor-pointer transition-shadow hover:shadow-md ${isExpanded ? "ring-2 ring-blue-300" : ""}`}
              onClick={() => setExpandedSegment(isExpanded ? null : key)}
            >
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${colorClass}`}>
                    {label}
                  </span>
                  <span className="text-lg font-bold text-gray-900">{users.length}명</span>
                </div>

                {/* 미니 통계 */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-gray-50 rounded-lg p-2">
                    <div className="text-gray-400">평균 계획서</div>
                    <div className="font-medium text-gray-700 mt-0.5">
                      {users.length > 0
                        ? (users.reduce((s, u) => s + u.planCount, 0) / users.length).toFixed(1)
                        : "0"}건
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <div className="text-gray-400">평균 프로필</div>
                    <div className="font-medium text-gray-700 mt-0.5">
                      {users.length > 0
                        ? (users.reduce((s, u) => s + u.profileScore, 0) / users.length).toFixed(0)
                        : "0"}%
                    </div>
                  </div>
                </div>

                {/* 사용자 목록 (펼친 상태) */}
                {isExpanded && users.length > 0 && (
                  <div className="mt-3 border-t pt-3 max-h-60 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-400">
                          <th className="text-left pb-1">이름</th>
                          <th className="text-right pb-1">계획서</th>
                          <th className="text-right pb-1">프로필</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {users.slice(0, 20).map((u) => (
                          <tr key={u.id}>
                            <td className="py-1.5">
                              <div className="font-medium text-gray-700">{u.name || "이름 없음"}</div>
                              <div className="text-gray-400">{u.email}</div>
                            </td>
                            <td className="text-right text-gray-600">{u.planCount}건</td>
                            <td className="text-right">
                              <Badge
                                variant={
                                  u.profileScore >= 70 ? "success" : u.profileScore >= 30 ? "default" : "warning"
                                }
                                className="text-[10px]"
                              >
                                {u.profileScore}%
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {users.length > 20 && (
                      <p className="text-xs text-gray-400 text-center mt-2">
                        + {users.length - 20}명 더
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 전체 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard title="유료 전환율" value={
          summary.totalUsers > 0
            ? `${(((summary.planDistribution["프로"] || 0) + (summary.planDistribution["올프리"] || 0)) / summary.totalUsers * 100).toFixed(1)}%`
            : "0%"
        } />
        <SummaryCard title="활발 사용자 비율" value={
          summary.totalUsers > 0
            ? `${((summary.activityDistribution["활발"] || 0) / summary.totalUsers * 100).toFixed(1)}%`
            : "0%"
        } />
        <SummaryCard title="최근 7일 가입" value={`${summary.joinDistribution["최근 7일"] || 0}명`} />
        <SummaryCard title="프로필 완성률" value={
          summary.totalUsers > 0
            ? `${((summary.profileDistribution["높음 (70%+)"] || 0) / summary.totalUsers * 100).toFixed(1)}%`
            : "0%"
        } />
      </div>
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="text-xs text-gray-500">{title}</div>
        <div className="text-xl font-bold text-gray-900 mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

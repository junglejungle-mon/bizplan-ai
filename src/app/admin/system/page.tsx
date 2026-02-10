"use client";

import { useEffect, useState } from "react";

interface SystemStatus {
  recentLogs: Array<{
    id: string;
    skill_name: string;
    action: string;
    status: string;
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
    model_used: string;
    duration_ms: number;
    created_at: string;
  }>;
  dailyStats: Array<{
    skill_name: string;
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
    status: string;
    created_at: string;
  }>;
  lastCollection: { created_at: string } | null;
  failedDocs: Array<{ id: string; title: string; status: string }>;
}

export default function AdminSystemPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/system/status")
      .then((r) => r.json())
      .then((data) => setStatus(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-center py-12 text-gray-400">로딩 중...</div>;
  }

  // 일일 통계 집계
  const dailyTotals = {
    totalTokens: (status?.dailyStats || []).reduce((s, d) => s + (d.input_tokens || 0) + (d.output_tokens || 0), 0),
    totalCost: (status?.dailyStats || []).reduce((s, d) => s + (d.cost_usd || 0), 0),
    totalCalls: status?.dailyStats?.length || 0,
    failedCalls: (status?.dailyStats || []).filter((d) => d.status === "failed").length,
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">시스템 관리</h1>

      {/* 상태 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-xs text-gray-500 mb-1">크론 마지막 수집</div>
          <div className="text-sm font-bold text-gray-900">
            {status?.lastCollection
              ? new Date(status.lastCollection.created_at).toLocaleString("ko-KR")
              : "기록 없음"}
          </div>
          <div className="text-xs text-gray-400 mt-1">매일 09:00, 15:00 (KST)</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-xs text-gray-500 mb-1">7일 API 호출</div>
          <div className="text-sm font-bold text-gray-900">{dailyTotals.totalCalls}회</div>
          <div className="text-xs text-gray-400 mt-1">{dailyTotals.failedCalls}건 실패</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-xs text-gray-500 mb-1">7일 토큰 사용</div>
          <div className="text-sm font-bold text-gray-900">{dailyTotals.totalTokens.toLocaleString()}</div>
          <div className="text-xs text-gray-400 mt-1">입력+출력 합계</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-xs text-gray-500 mb-1">7일 예상 비용</div>
          <div className="text-sm font-bold text-gray-900">${dailyTotals.totalCost.toFixed(4)}</div>
          <div className="text-xs text-gray-400 mt-1">Anthropic + OpenAI</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 실패한 레퍼런스 문서 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">실패한 레퍼런스 문서</h2>
          {status?.failedDocs?.length === 0 ? (
            <p className="text-sm text-green-600">모두 정상</p>
          ) : (
            <div className="space-y-2">
              {status?.failedDocs?.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 truncate max-w-[250px]">{doc.title}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                    {doc.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 환경 정보 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">환경 정보</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Next.js Runtime</span>
              <span className="text-gray-700 font-mono text-xs">App Router</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Database</span>
              <span className="text-gray-700 font-mono text-xs">Supabase (PostgreSQL)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">AI Models</span>
              <span className="text-gray-700 font-mono text-xs">Sonnet 4 / Haiku 4.5</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Embedding</span>
              <span className="text-gray-700 font-mono text-xs">text-embedding-3-small</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Cron Schedule</span>
              <span className="text-gray-700 font-mono text-xs">0 0,6 * * * (UTC)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Sentry</span>
              <span className="text-gray-700 font-mono text-xs">설정 완료 (DSN 필요)</span>
            </div>
          </div>
        </div>
      </div>

      {/* 최근 에이전트 로그 */}
      {status?.recentLogs && status.recentLogs.length > 0 && (
        <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">최근 에이전트 로그</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-3 py-2 font-medium text-gray-600">스킬</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">액션</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">모델</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">토큰</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">소요시간</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">상태</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">시각</th>
                </tr>
              </thead>
              <tbody>
                {status.recentLogs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-50">
                    <td className="px-3 py-2 font-mono">{log.skill_name}</td>
                    <td className="px-3 py-2">{log.action}</td>
                    <td className="px-3 py-2 text-gray-400">{log.model_used || "-"}</td>
                    <td className="px-3 py-2">{((log.input_tokens || 0) + (log.output_tokens || 0)).toLocaleString()}</td>
                    <td className="px-3 py-2">{log.duration_ms ? `${(log.duration_ms / 1000).toFixed(1)}s` : "-"}</td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        log.status === "completed" ? "bg-green-100 text-green-700" :
                        log.status === "failed" ? "bg-red-100 text-red-700" :
                        "bg-yellow-100 text-yellow-700"
                      }`}>{log.status}</span>
                    </td>
                    <td className="px-3 py-2 text-gray-400">{new Date(log.created_at).toLocaleString("ko-KR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

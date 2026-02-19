"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";

interface Matching {
  id: string;
  match_score: number;
  match_reason: string;
  match_detail: string | null;
  fit_level: string;
  status: string;
  match_keywords: string[] | null;
  score_breakdown: Record<string, number> | null;
  region_match: boolean;
  created_at: string;
  companies: { id: string; name: string; industry: string | null; region: string | null };
  programs: { id: string; title: string; institution: string; apply_start: string; apply_end: string };
}

interface MatchingStats {
  distribution: Record<string, number>;
  avgScore: number;
  totalMatchings: number;
  topPrograms: Array<{ id: string; title: string; count: number }>;
}

const FIT_BADGE: Record<string, { label: string; variant: "success" | "warning" | "secondary" | "destructive" }> = {
  high: { label: "HIGH", variant: "success" },
  "매우적합": { label: "매우적합", variant: "success" },
  medium: { label: "MEDIUM", variant: "warning" },
  "적합": { label: "적합", variant: "warning" },
  "검토추천": { label: "검토추천", variant: "secondary" },
  "참고": { label: "참고", variant: "secondary" },
  low: { label: "LOW", variant: "destructive" },
  "부적합": { label: "부적합", variant: "destructive" },
};

const FIT_LEVELS = ["", "high", "매우적합", "medium", "적합", "검토추천", "참고", "low", "부적합"];

export default function AdminMatchingsPage() {
  const [matchings, setMatchings] = useState<Matching[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<MatchingStats | null>(null);
  const [page, setPage] = useState(1);
  const [fitFilter, setFitFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const limit = 50;

  const fetchMatchings = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (fitFilter) params.set("fit_level", fitFilter);
    try {
      const res = await fetch(`/api/admin/matchings?${params}`);
      if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
      const data = await res.json();
      setMatchings(data.matchings || []);
      setTotal(data.total || 0);
      setStats(data.stats || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "매칭 현황을 불러올 수 없습니다.");
    }
    setLoading(false);
  }, [page, fitFilter]);

  useEffect(() => {
    fetchMatchings();
  }, [fetchMatchings]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">매칭 현황</h1>
          <p className="text-sm text-gray-500 mt-1">{stats?.totalMatchings?.toLocaleString() || 0}건 전체 매칭</p>
        </div>
      </div>

      {/* 통계 카드 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-xs text-gray-500 mb-1">전체 매칭</div>
            <div className="text-2xl font-bold text-gray-900">{stats.totalMatchings.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-xs text-gray-500 mb-1">평균 매칭 점수</div>
            <div className="text-2xl font-bold text-blue-600">{stats.avgScore}점</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 col-span-2">
            <div className="text-xs text-gray-500 mb-2">적합도 분포</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.distribution).map(([level, count]) => {
                const badge = FIT_BADGE[level] || { label: level, variant: "secondary" as const };
                return (
                  <button
                    key={level}
                    onClick={() => { setFitFilter(fitFilter === level ? "" : level); setPage(1); }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-colors ${
                      fitFilter === level ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <Badge variant={badge.variant} className="text-[9px]">{badge.label}</Badge>
                    <span className="font-medium text-gray-700">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TOP 프로그램 */}
      {stats && stats.topPrograms.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">매칭 TOP 10 프로그램</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {stats.topPrograms.map((prog, idx) => (
              <div key={prog.id} className="flex items-center gap-3 py-1.5">
                <span className={`text-xs font-bold w-5 text-center ${idx < 3 ? "text-blue-600" : "text-gray-400"}`}>{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-700 truncate">{prog.title}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-20 h-1.5 rounded-full bg-gray-100">
                    <div
                      className="h-1.5 rounded-full bg-blue-500"
                      style={{ width: `${Math.min((prog.count / (stats.topPrograms[0]?.count || 1)) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-600 w-8 text-right">{prog.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 필터 */}
      <div className="flex gap-2 mb-4">
        <select
          value={fitFilter}
          onChange={(e) => { setFitFilter(e.target.value); setPage(1); }}
          className="h-10 rounded-lg border border-gray-300 px-3 text-sm"
        >
          <option value="">전체 적합도</option>
          {FIT_LEVELS.filter(Boolean).map((level) => (
            <option key={level} value={level}>{FIT_BADGE[level]?.label || level}</option>
          ))}
        </select>
        {fitFilter && (
          <button onClick={() => { setFitFilter(""); setPage(1); }} className="h-10 px-3 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">
            초기화
          </button>
        )}
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[1000px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-600">업체</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">프로그램</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">점수</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">적합도</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">키워드</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">점수 분석</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">접수기간</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto" />
                <p className="mt-2 text-sm">로딩 중...</p>
              </td></tr>
            ) : error ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center">
                <p className="text-sm text-red-500 mb-2">{error}</p>
                <button onClick={fetchMatchings} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700">다시 시도</button>
              </td></tr>
            ) : matchings.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">매칭 결과 없음</td></tr>
            ) : matchings.map((m) => {
              const badge = FIT_BADGE[m.fit_level] || { label: m.fit_level, variant: "secondary" as const };
              return (
                <tr key={m.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="text-xs font-medium text-gray-800">{m.companies.name}</div>
                    <div className="text-[10px] text-gray-400">{m.companies.industry || "-"} | {m.companies.region || "-"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-gray-700 truncate max-w-[200px]">{m.programs.title}</div>
                    <div className="text-[10px] text-gray-400">{m.programs.institution}</div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-sm font-bold ${
                      m.match_score >= 80 ? "text-green-600" : m.match_score >= 60 ? "text-blue-600" : "text-gray-500"
                    }`}>{m.match_score}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={badge.variant} className="text-[10px]">{badge.label}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1 max-w-[150px]">
                      {m.match_keywords?.slice(0, 3).map((kw) => (
                        <span key={kw} className="text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{kw}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {m.score_breakdown ? (
                      <div className="flex gap-1 flex-wrap max-w-[180px]">
                        {Object.entries(m.score_breakdown).map(([key, val]) => (
                          <span key={key} className="text-[9px] px-1 py-0.5 bg-green-50 text-green-700 rounded">
                            {key.replace("_fit", "")}:{val}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[10px] text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[10px] text-gray-500">
                    {m.programs.apply_start}<br/>~ {m.programs.apply_end}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button onClick={() => setPage(1)} disabled={page === 1} className="h-8 px-3 rounded border text-sm disabled:opacity-30">처음</button>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="h-8 px-3 rounded border text-sm disabled:opacity-30">이전</button>
          <span className="text-sm text-gray-500 px-2">{page} / {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="h-8 px-3 rounded border text-sm disabled:opacity-30">다음</button>
          <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="h-8 px-3 rounded border text-sm disabled:opacity-30">마지막</button>
        </div>
      )}
    </div>
  );
}

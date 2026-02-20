"use client";

import { useEffect, useState, useCallback } from "react";
import { QualityBadge } from "@/components/admin/quality-badge";

interface Plan {
  id: string;
  title: string;
  status: string;
  created_at: string;
  company_name: string;
  company_industry: string;
  program_title: string | null;
  quality_score: number | null;
  match_score: number | null;
  section_count: number;
}

interface PlanDetail {
  plan: Plan;
  sections: Array<{
    id: string;
    section_name: string;
    section_order: number;
    content_preview: string;
    content_length: number;
    generation_count: number;
  }>;
  quality: {
    overall: { total_score: number; feedback: string; criteria_scores: Record<string, number> } | null;
    by_section: Array<{ section_id: string; total_score: number }>;
  };
  matching: { match_score: number; match_reason: string; fit_level: string } | null;
  ir_presentation: { id: string; title: string; template: string; status: string } | null;
}

interface Stats {
  total: number;
  completed: number;
  avgQuality: number;
  high: number;
  medium: number;
  low: number;
}

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [qualityFilter, setQualityFilter] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PlanDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const limit = 50;

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      sort: sortBy,
      order: sortOrder,
    });
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    if (qualityFilter) params.set("quality", qualityFilter);

    try {
      const res = await fetch(`/api/admin/plans?${params}`);
      if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
      const data = await res.json();
      setPlans(data.plans || []);
      setTotal(data.total || 0);
      setStats(data.stats || null);
    } catch (err) {
      console.error("계획서 목록 조회 실패:", err);
    }
    setLoading(false);
  }, [page, search, statusFilter, qualityFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const handleSelect = async (planId: string) => {
    if (selectedId === planId) {
      setSelectedId(null);
      setDetail(null);
      return;
    }
    setSelectedId(planId);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/plans/${planId}`);
      if (res.ok) {
        setDetail(await res.json());
      }
    } catch (err) {
      console.error("상세 조회 실패:", err);
    }
    setDetailLoading(false);
  };

  const handleDownload = async (planId: string, format: string) => {
    setDownloading(`${planId}-${format}`);
    try {
      const res = await fetch(`/api/admin/plans/${planId}/export?format=${format}`);
      if (!res.ok) throw new Error("다운로드 실패");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = res.headers.get("Content-Disposition") || "";
      const utf8Match = disposition.match(/filename\*=UTF-8''(.+?)(?:;|$)/i);
      const filenameMatch = disposition.match(/filename="(.+?)"/);
      a.download = utf8Match
        ? decodeURIComponent(utf8Match[1])
        : filenameMatch
        ? decodeURIComponent(filenameMatch[1])
        : `plan.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("다운로드 오류:", err);
    }
    setDownloading(null);
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
    setPage(1);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">사업계획서 관리</h1>
          <p className="text-sm text-gray-500 mt-1">{total.toLocaleString()}개 계획서</p>
        </div>
      </div>

      {/* 통계 카드 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard label="전체" value={stats.total} />
          <StatCard label="평균 품질" value={`${stats.avgQuality}점`} color={stats.avgQuality >= 80 ? "green" : stats.avgQuality >= 60 ? "yellow" : "red"} />
          <StatCard label="완료" value={stats.completed} color="blue" />
          <div className="bg-white rounded-lg border p-3">
            <p className="text-[10px] text-gray-500 mb-1">품질 분포</p>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-green-600 font-medium">{stats.high} 우수</span>
              <span className="text-yellow-600 font-medium">{stats.medium} 보통</span>
              <span className="text-red-600 font-medium">{stats.low} 개선</span>
            </div>
          </div>
        </div>
      )}

      {/* 필터 + 검색 */}
      <div className="flex flex-wrap gap-2 mb-4">
        <form onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); setPage(1); }} className="flex gap-2 flex-1 min-w-[200px] max-w-md">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="제목, 기업명 검색..."
            className="flex-1 h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button type="submit" className="h-9 px-3 rounded-lg bg-gray-100 text-sm hover:bg-gray-200 font-medium">검색</button>
        </form>

        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="h-9 rounded-lg border border-gray-300 px-2 text-sm"
        >
          <option value="">전체 상태</option>
          <option value="completed">완료</option>
          <option value="generating">생성중</option>
          <option value="draft">초안</option>
          <option value="failed">실패</option>
        </select>

        <select
          value={qualityFilter}
          onChange={(e) => { setQualityFilter(e.target.value); setPage(1); }}
          className="h-9 rounded-lg border border-gray-300 px-2 text-sm"
        >
          <option value="">전체 품질</option>
          <option value="high">우수 (80+)</option>
          <option value="medium">보통 (60~79)</option>
          <option value="low">개선필요 (&lt;60)</option>
        </select>

        {(search || statusFilter || qualityFilter) && (
          <button
            onClick={() => { setSearch(""); setSearchInput(""); setStatusFilter(""); setQualityFilter(""); setPage(1); }}
            className="h-9 px-3 text-sm text-gray-500 hover:bg-gray-100 rounded-lg"
          >
            초기화
          </button>
        )}
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[1000px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-600">기업명</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">프로그램</th>
              <th
                className="text-center px-4 py-3 font-medium text-gray-600 cursor-pointer hover:text-blue-600"
                onClick={() => handleSort("match_score")}
              >
                매칭 {sortBy === "match_score" ? (sortOrder === "asc" ? "↑" : "↓") : ""}
              </th>
              <th
                className="text-center px-4 py-3 font-medium text-gray-600 cursor-pointer hover:text-blue-600"
                onClick={() => handleSort("quality_score")}
              >
                품질 {sortBy === "quality_score" ? (sortOrder === "asc" ? "↑" : "↓") : ""}
              </th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">섹션</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">상태</th>
              <th
                className="text-left px-4 py-3 font-medium text-gray-600 cursor-pointer hover:text-blue-600"
                onClick={() => handleSort("created_at")}
              >
                날짜 {sortBy === "created_at" ? (sortOrder === "asc" ? "↑" : "↓") : ""}
              </th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">다운로드</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                  <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto" />
                  <p className="mt-2 text-sm">로딩 중...</p>
                </td>
              </tr>
            ) : plans.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-400">계획서 없음</td>
              </tr>
            ) : (
              plans.map((p) => (
                <tbody key={p.id}>
                  <tr
                    className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${selectedId === p.id ? "bg-blue-50 hover:bg-blue-50" : ""}`}
                    onClick={() => handleSelect(p.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{p.company_name}</div>
                      <div className="text-xs text-gray-400">{p.company_industry}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 max-w-[200px] truncate">
                      {p.program_title || "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {p.match_score ? (
                        <span className={`text-xs font-bold ${p.match_score >= 80 ? "text-green-600" : p.match_score >= 60 ? "text-yellow-600" : "text-gray-500"}`}>
                          {p.match_score}점
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <QualityBadge score={p.quality_score} />
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-500">
                      {p.section_count}/8
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(p.created_at).toLocaleDateString("ko-KR")}
                    </td>
                    <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1 justify-center">
                        <button
                          onClick={() => handleDownload(p.id, "docx")}
                          disabled={downloading === `${p.id}-docx` || p.status !== "completed"}
                          className="text-[10px] px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:opacity-30 font-medium"
                        >
                          {downloading === `${p.id}-docx` ? "..." : "DOCX"}
                        </button>
                        <button
                          onClick={() => handleDownload(p.id, "pdf")}
                          disabled={downloading === `${p.id}-pdf` || p.status !== "completed"}
                          className="text-[10px] px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-30 font-medium"
                        >
                          {downloading === `${p.id}-pdf` ? "..." : "PDF"}
                        </button>
                        <button
                          onClick={() => handleDownload(p.id, "md")}
                          disabled={downloading === `${p.id}-md` || p.status !== "completed"}
                          className="text-[10px] px-2 py-1 rounded bg-gray-50 text-gray-600 hover:bg-gray-100 disabled:opacity-30 font-medium"
                        >
                          {downloading === `${p.id}-md` ? "..." : "MD"}
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* 상세 펼침 */}
                  {selectedId === p.id && (
                    <tr>
                      <td colSpan={8} className="px-4 py-4 bg-gray-50 border-b border-gray-200">
                        {detailLoading ? (
                          <div className="text-center py-6 text-gray-400">
                            <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full mx-auto" />
                          </div>
                        ) : detail ? (
                          <PlanDetailPanel detail={detail} />
                        ) : null}
                      </td>
                    </tr>
                  )}
                </tbody>
              ))
            )}
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

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  const colorMap: Record<string, string> = {
    green: "text-green-600",
    yellow: "text-yellow-600",
    red: "text-red-600",
    blue: "text-blue-600",
  };
  return (
    <div className="bg-white rounded-lg border p-3">
      <p className="text-[10px] text-gray-500 mb-1">{label}</p>
      <p className={`text-lg font-bold ${color ? colorMap[color] || "text-gray-900" : "text-gray-900"}`}>
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: "bg-green-100 text-green-700",
    generating: "bg-yellow-100 text-yellow-700",
    draft: "bg-gray-100 text-gray-600",
    failed: "bg-red-100 text-red-700",
  };
  const labels: Record<string, string> = {
    completed: "완료",
    generating: "생성중",
    draft: "초안",
    failed: "실패",
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${styles[status] || "bg-gray-100 text-gray-600"}`}>
      {labels[status] || status}
    </span>
  );
}

function PlanDetailPanel({ detail }: { detail: PlanDetail }) {
  const { sections, quality, matching, ir_presentation } = detail;

  return (
    <div className="space-y-4">
      {/* 상단 정보 */}
      <div className="flex flex-wrap gap-4">
        {matching && (
          <div className="bg-white rounded-lg border p-3 flex-1 min-w-[200px]">
            <h4 className="text-[10px] text-gray-500 mb-1">매칭 정보</h4>
            <p className="text-sm font-bold text-green-600">{matching.match_score}점 ({matching.fit_level})</p>
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{matching.match_reason}</p>
          </div>
        )}
        {quality.overall && (
          <div className="bg-white rounded-lg border p-3 flex-1 min-w-[200px]">
            <h4 className="text-[10px] text-gray-500 mb-1">품질 평가</h4>
            <p className="text-sm font-bold">{quality.overall.total_score}점</p>
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{quality.overall.feedback}</p>
          </div>
        )}
        {ir_presentation && (
          <div className="bg-white rounded-lg border p-3 flex-1 min-w-[200px]">
            <h4 className="text-[10px] text-gray-500 mb-1">IR PPT</h4>
            <p className="text-sm font-medium text-gray-800">{ir_presentation.title}</p>
            <p className="text-xs text-gray-400">템플릿: {ir_presentation.template} | {ir_presentation.status}</p>
          </div>
        )}
      </div>

      {/* 섹션 미리보기 */}
      <div className="bg-white rounded-lg border p-4">
        <h4 className="text-xs font-semibold text-gray-500 mb-3">섹션 ({sections.length}개)</h4>
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {sections.map((s) => (
            <div key={s.id} className="border-l-2 border-purple-300 pl-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-gray-700">{s.section_order}. {s.section_name}</span>
                <span className="text-[9px] text-gray-400">{s.content_length.toLocaleString()}자</span>
                {s.generation_count > 1 && (
                  <span className="text-[9px] px-1 py-0.5 bg-blue-50 text-blue-600 rounded">v{s.generation_count}</span>
                )}
              </div>
              <p className="text-xs text-gray-500 leading-relaxed line-clamp-3">{s.content_preview}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { QualityBadge } from "@/components/admin/quality-badge";

interface IRPresentation {
  id: string;
  title: string;
  template: string;
  status: string;
  created_at: string;
  company_name: string;
  company_industry: string;
  plan_title: string | null;
  slide_count: number;
  quality_score: number | null;
}

interface Stats {
  total: number;
  completed: number;
  avgQuality: number;
  high: number;
  medium: number;
  low: number;
  templates: { minimal: number; tech: number; classic: number };
}

export default function AdminIRPage() {
  const [presentations, setPresentations] = useState<IRPresentation[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [templateFilter, setTemplateFilter] = useState("");
  const [qualityFilter, setQualityFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const limit = 50;

  const fetchPresentations = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set("search", search);
    if (templateFilter) params.set("template", templateFilter);
    if (qualityFilter) params.set("quality", qualityFilter);

    try {
      const res = await fetch(`/api/admin/ir?${params}`);
      if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
      const data = await res.json();
      setPresentations(data.presentations || []);
      setTotal(data.total || 0);
      setStats(data.stats || null);
    } catch (err) {
      console.error("IR 목록 조회 실패:", err);
    }
    setLoading(false);
  }, [page, search, templateFilter, qualityFilter]);

  useEffect(() => {
    fetchPresentations();
  }, [fetchPresentations]);

  const handleDownload = async (presentationId: string) => {
    setDownloading(presentationId);
    try {
      const res = await fetch(`/api/admin/ir/${presentationId}/export`);
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
        : "ir.pptx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("다운로드 오류:", err);
    }
    setDownloading(null);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">IR PPT 관리</h1>
          <p className="text-sm text-gray-500 mt-1">{total.toLocaleString()}개 IR 프레젠테이션</p>
        </div>
      </div>

      {/* 통계 카드 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <StatCard label="전체" value={stats.total} />
          <StatCard label="완료" value={stats.completed} color="blue" />
          <StatCard label="평균 품질" value={`${stats.avgQuality}점`} color={stats.avgQuality >= 80 ? "green" : stats.avgQuality >= 60 ? "yellow" : "red"} />
          <div className="bg-white rounded-lg border p-3">
            <p className="text-[10px] text-gray-500 mb-1">품질 분포</p>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-green-600 font-medium">{stats.high} 우수</span>
              <span className="text-yellow-600 font-medium">{stats.medium} 보통</span>
              <span className="text-red-600 font-medium">{stats.low} 개선</span>
            </div>
          </div>
          <div className="bg-white rounded-lg border p-3">
            <p className="text-[10px] text-gray-500 mb-1">템플릿 분포</p>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-blue-600 font-medium">{stats.templates.minimal} minimal</span>
              <span className="text-purple-600 font-medium">{stats.templates.tech} tech</span>
              <span className="text-gray-600 font-medium">{stats.templates.classic} classic</span>
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
          value={templateFilter}
          onChange={(e) => { setTemplateFilter(e.target.value); setPage(1); }}
          className="h-9 rounded-lg border border-gray-300 px-2 text-sm"
        >
          <option value="">전체 템플릿</option>
          <option value="minimal">Minimal</option>
          <option value="tech">Tech</option>
          <option value="classic">Classic</option>
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

        {(search || templateFilter || qualityFilter) && (
          <button
            onClick={() => { setSearch(""); setSearchInput(""); setTemplateFilter(""); setQualityFilter(""); setPage(1); }}
            className="h-9 px-3 text-sm text-gray-500 hover:bg-gray-100 rounded-lg"
          >
            초기화
          </button>
        )}
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-600">기업명</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">IR 제목</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">템플릿</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">슬라이드</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">품질</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">상태</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">날짜</th>
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
            ) : presentations.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-400">IR 프레젠테이션 없음</td>
              </tr>
            ) : (
              presentations.map((pres) => (
                <tr key={pres.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{pres.company_name}</div>
                    <div className="text-xs text-gray-400">{pres.company_industry}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-gray-700 max-w-[200px] truncate">{pres.title}</div>
                    {pres.plan_title && (
                      <div className="text-[10px] text-gray-400 truncate max-w-[200px]">{pres.plan_title}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <TemplateBadge template={pres.template} />
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-gray-500">
                    {pres.slide_count}장
                  </td>
                  <td className="px-4 py-3 text-center">
                    <QualityBadge score={pres.quality_score} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      pres.status === "completed" ? "bg-green-100 text-green-700" :
                      pres.status === "generating" ? "bg-yellow-100 text-yellow-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {pres.status === "completed" ? "완료" : pres.status === "generating" ? "생성중" : pres.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(pres.created_at).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleDownload(pres.id)}
                      disabled={downloading === pres.id || pres.status !== "completed"}
                      className="text-[10px] px-3 py-1 rounded bg-orange-50 text-orange-600 hover:bg-orange-100 disabled:opacity-30 font-medium"
                    >
                      {downloading === pres.id ? "..." : "PPTX"}
                    </button>
                  </td>
                </tr>
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

function TemplateBadge({ template }: { template: string }) {
  const styles: Record<string, string> = {
    minimal: "bg-blue-50 text-blue-600",
    tech: "bg-purple-50 text-purple-600",
    classic: "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${styles[template] || "bg-gray-100 text-gray-600"}`}>
      {template}
    </span>
  );
}

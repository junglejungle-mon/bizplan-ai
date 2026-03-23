"use client";

import { Fragment, useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";

interface Company {
  id: string;
  name: string;
  business_content: string;
  industry: string | null;
  region: string | null;
  employee_count: number | null;
  revenue: string | null;
  established_date: string | null;
  profile_score: number | null;
  is_active: boolean;
  created_at: string;
  profiles: { id: string; email: string; name: string | null };
  interview_count: number;
  matching_count: number;
  plan_count: number;
}

interface CompanyDetail {
  company: Company;
  interviews: Array<{
    id: string;
    question: string;
    answer: string;
    category: string;
    round: number;
    extracted_insights: Record<string, unknown> | null;
  }>;
  matchings: Array<{
    id: string;
    match_score: number;
    match_reason: string;
    match_detail: string | null;
    fit_level: string;
    status: string;
    match_keywords: string[] | null;
    score_breakdown: Record<string, number> | null;
    programs: { id: string; title: string; institution: string; apply_start: string; apply_end: string };
  }>;
  plans: Array<{
    id: string;
    title: string;
    status: string;
    created_at: string;
  }>;
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

const CATEGORY_LABEL: Record<string, string> = {
  basic: "사업 핵심",
  business: "비즈니스 모델",
  team_evidence: "팀/실적",
  strategy: "성장 전략",
  optimization: "지원 최적화",
};

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CompanyDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const limit = 50;

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set("search", search);
    try {
      const res = await fetch(`/api/admin/companies?${params}`);
      if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
      const data = await res.json();
      setCompanies(data.companies || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "업체 목록을 불러올 수 없습니다.");
    }
    setLoading(false);
  }, [page, search]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const handleSelect = async (companyId: string) => {
    if (selectedId === companyId) {
      setSelectedId(null);
      setDetail(null);
      return;
    }
    setSelectedId(companyId);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/companies/${companyId}`);
      if (res.ok) {
        setDetail(await res.json());
      }
    } catch (err) {
      console.error("업체 상세 조회 실패:", err);
    }
    setDetailLoading(false);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">업체 관리</h1>
          <p className="text-sm text-gray-500 mt-1">{total.toLocaleString()}개 업체</p>
        </div>
      </div>

      {/* 검색 */}
      <form
        onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); setPage(1); }}
        className="flex gap-2 mb-4"
      >
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="업체명, 업종, 사업내용 검색..."
          className="flex-1 h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-md"
        />
        <button type="submit" className="h-10 px-4 rounded-lg bg-gray-100 text-sm hover:bg-gray-200 font-medium">검색</button>
        {search && (
          <button type="button" onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }} className="h-10 px-3 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">초기화</button>
        )}
      </form>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-600">업체명</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">업종</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">지역</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">직원</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">프로필</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">인터뷰</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">매칭</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">계획서</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">등록일</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto" />
                <p className="mt-2 text-sm">로딩 중...</p>
              </td></tr>
            ) : error ? (
              <tr><td colSpan={9} className="px-4 py-12 text-center">
                <p className="text-sm text-red-500 mb-2">{error}</p>
                <button onClick={fetchCompanies} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700">다시 시도</button>
              </td></tr>
            ) : companies.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400">업체 없음</td></tr>
            ) : companies.map((c) => (
              <Fragment key={c.id}>
                <tr
                  className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${selectedId === c.id ? "bg-blue-50 hover:bg-blue-50" : ""}`}
                  onClick={() => handleSelect(c.id)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{c.name}</div>
                    <div className="text-xs text-gray-400 truncate max-w-[200px]">{c.profiles?.email}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{c.industry || "-"}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{c.region || "-"}</td>
                  <td className="px-4 py-3 text-center text-gray-500">{c.employee_count || "-"}</td>
                  <td className="px-4 py-3 text-center"><ProfileBar score={c.profile_score || 0} /></td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-medium ${c.interview_count > 0 ? "text-blue-600" : "text-gray-400"}`}>{c.interview_count}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-medium ${c.matching_count > 0 ? "text-green-600" : "text-gray-400"}`}>{c.matching_count}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-medium ${c.plan_count > 0 ? "text-purple-600" : "text-gray-400"}`}>{c.plan_count}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{new Date(c.created_at).toLocaleDateString("ko-KR")}</td>
                </tr>

                {/* 상세 펼침 */}
                {selectedId === c.id && (
                  <tr>
                    <td colSpan={9} className="px-4 py-4 bg-gray-50 border-b border-gray-200">
                      {detailLoading ? (
                        <div className="text-center py-6 text-gray-400">
                          <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full mx-auto" />
                        </div>
                      ) : detail ? (
                        <CompanyDetailPanel detail={detail} />
                      ) : null}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
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

function ProfileBar({ score }: { score: number }) {
  const color = score >= 70 ? "bg-green-500" : score >= 30 ? "bg-blue-500" : "bg-orange-400";
  return (
    <div className="flex items-center gap-1.5 justify-center">
      <div className="w-14 h-1.5 rounded-full bg-gray-200">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.min(score, 100)}%` }} />
      </div>
      <span className="text-[10px] text-gray-400">{score}</span>
    </div>
  );
}

function CompanyDetailPanel({ detail }: { detail: CompanyDetail }) {
  const { company, interviews, matchings, plans } = detail;

  return (
    <div className="space-y-4">
      {/* 업체 개요 */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="text-sm font-semibold text-gray-800 mb-2">사업 내용</h3>
        <p className="text-sm text-gray-600 leading-relaxed">{company.business_content || "미입력"}</p>
        <div className="flex gap-4 mt-3 text-xs text-gray-500">
          <span>매출: {company.revenue || "-"}</span>
          <span>설립: {company.established_date || "-"}</span>
          <span>대표: {company.profiles?.name || "-"}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 인터뷰 */}
        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-xs font-semibold text-gray-500 mb-3">인터뷰 ({interviews.length}건)</h3>
          {interviews.length === 0 ? (
            <p className="text-xs text-gray-400">없음</p>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {interviews.map((iv) => (
                <div key={iv.id} className="border-l-2 border-blue-300 pl-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary" className="text-[10px]">R{iv.round}</Badge>
                    <span className="text-[10px] text-gray-400">{CATEGORY_LABEL[iv.category] || iv.category}</span>
                  </div>
                  <p className="text-xs text-gray-600 font-medium">{iv.question}</p>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-3">{iv.answer}</p>
                  {iv.extracted_insights && Object.keys(iv.extracted_insights).length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {Object.entries(iv.extracted_insights).map(([key, val]) => (
                        <span key={key} className="text-[9px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">
                          {key}: {String(val)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 매칭 */}
        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-xs font-semibold text-gray-500 mb-3">프로그램 매칭 ({matchings.length}건)</h3>
          {matchings.length === 0 ? (
            <p className="text-xs text-gray-400">없음</p>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {matchings.map((m) => {
                const badgeInfo = FIT_BADGE[m.fit_level] || { label: m.fit_level, variant: "secondary" as const };
                return (
                  <div key={m.id} className="border-l-2 border-green-300 pl-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={badgeInfo.variant} className="text-[10px]">{badgeInfo.label}</Badge>
                      <span className="text-xs font-bold text-gray-800">{m.match_score}점</span>
                    </div>
                    <p className="text-xs text-gray-700 font-medium truncate">{m.programs.title}</p>
                    <p className="text-[10px] text-gray-400">{m.programs.institution}</p>
                    <p className="text-[10px] text-gray-400">{m.programs.apply_start} ~ {m.programs.apply_end}</p>
                    {m.score_breakdown && (
                      <div className="mt-1 flex gap-1 flex-wrap">
                        {Object.entries(m.score_breakdown).map(([key, val]) => (
                          <span key={key} className="text-[9px] px-1 py-0.5 bg-green-50 text-green-700 rounded">
                            {key.replace("_fit", "")}: {val}
                          </span>
                        ))}
                      </div>
                    )}
                    {m.match_keywords && m.match_keywords.length > 0 && (
                      <div className="mt-1 flex gap-1 flex-wrap">
                        {m.match_keywords.map((kw) => (
                          <span key={kw} className="text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{kw}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 사업계획서 */}
        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-xs font-semibold text-gray-500 mb-3">사업계획서 ({plans.length}건)</h3>
          {plans.length === 0 ? (
            <p className="text-xs text-gray-400">없음</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {plans.map((p) => (
                <div key={p.id} className="border-l-2 border-purple-300 pl-3">
                  <p className="text-xs text-gray-700 font-medium">{p.title || "(제목 없음)"}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      p.status === "completed" ? "bg-green-100 text-green-700" :
                      p.status === "generating" ? "bg-yellow-100 text-yellow-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>{p.status}</span>
                    <span className="text-[10px] text-gray-400">{new Date(p.created_at).toLocaleDateString("ko-KR")}</span>
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

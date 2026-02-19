"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Program {
  id: string;
  title: string;
  source: string;
  source_id: string | null;
  summary: string | null;
  target: string | null;
  hashtags: string[] | null;
  apply_start: string | null;
  apply_end: string | null;
  institution: string | null;
  detail_url: string | null;
  collected_at: string;
}

const SOURCE_OPTIONS = [
  { value: "", label: "전체" },
  { value: "bizinfo", label: "기업마당" },
  { value: "mss", label: "중기부" },
  { value: "kstartup", label: "K-Startup" },
];

const STATUS_OPTIONS = [
  { value: "", label: "전체" },
  { value: "active", label: "진행중" },
  { value: "expired", label: "마감" },
  { value: "upcoming", label: "예정" },
];

const SORT_OPTIONS = [
  { value: "collected_at", label: "수집일" },
  { value: "apply_end", label: "마감일" },
  { value: "apply_start", label: "시작일" },
  { value: "title", label: "프로그램명" },
  { value: "institution", label: "기관명" },
];

const sourceLabel = (s: string) => {
  switch (s) {
    case "bizinfo": return "기업마당";
    case "mss": return "중기부";
    case "kstartup": return "K-Startup";
    default: return s;
  }
};

export default function AdminProgramsPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [institutionFilter, setInstitutionFilter] = useState("");
  const [applyEndFrom, setApplyEndFrom] = useState("");
  const [applyEndTo, setApplyEndTo] = useState("");
  const [sortField, setSortField] = useState("collected_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [institutions, setInstitutions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collecting, setCollecting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const limit = 50;

  const activeFilterCount = [
    sourceFilter, statusFilter, institutionFilter, applyEndFrom, applyEndTo,
  ].filter(Boolean).length;

  const fetchPrograms = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      sort: sortField,
      order: sortOrder,
    });
    if (search) params.set("search", search);
    if (sourceFilter) params.set("source", sourceFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (institutionFilter) params.set("institution", institutionFilter);
    if (applyEndFrom) params.set("apply_end_from", applyEndFrom);
    if (applyEndTo) params.set("apply_end_to", applyEndTo);

    try {
      const res = await fetch(`/api/admin/programs?${params}`);
      if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
      const data = await res.json();
      setPrograms(data.programs || []);
      setTotal(data.total || 0);
      if (data.institutions) setInstitutions(data.institutions);
    } catch (err) {
      console.error("프로그램 목록 조회 실패:", err);
      setError(err instanceof Error ? err.message : "프로그램 목록을 불러올 수 없습니다.");
    }
    setLoading(false);
  }, [page, search, sourceFilter, statusFilter, institutionFilter, applyEndFrom, applyEndTo, sortField, sortOrder]);

  useEffect(() => {
    fetchPrograms();
  }, [fetchPrograms]);

  const handleCollect = async () => {
    setCollecting(true);
    try {
      const res = await fetch("/api/admin/programs", { method: "POST" });
      if (!res.ok) {
        console.error("프로그램 수집 실패:", res.status);
        toast.error("프로그램 수집에 실패했습니다.");
      } else {
        toast.success("프로그램 수집이 시작되었습니다.");
        setTimeout(() => fetchPrograms(), 2000);
      }
    } catch (err) {
      console.error("프로그램 수집 오류:", err);
      toast.error("프로그램 수집 중 오류가 발생했습니다.");
    }
    setCollecting(false);
  };

  const resetFilters = () => {
    setSourceFilter("");
    setStatusFilter("");
    setInstitutionFilter("");
    setApplyEndFrom("");
    setApplyEndTo("");
    setSortField("collected_at");
    setSortOrder("desc");
    setSearch("");
    setSearchInput("");
    setPage(1);
  };

  const toggleSelect = (id: string) => {
    if (selectedId === id) {
      setSelectedId(null);
      setEditMode(false);
      return;
    }
    setSelectedId(id);
    setEditMode(false);
  };

  const startEdit = (p: Program) => {
    setEditForm({
      title: p.title || "",
      summary: p.summary || "",
      target: p.target || "",
      institution: p.institution || "",
      apply_start: p.apply_start?.split("T")[0] || "",
      apply_end: p.apply_end?.split("T")[0] || "",
      detail_url: p.detail_url || "",
    });
    setEditMode(true);
  };

  const handleSave = async (id: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/programs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        const { program } = await res.json();
        setPrograms((prev) => prev.map((p) => (p.id === id ? { ...p, ...program } : p)));
        setEditMode(false);
      } else {
        const data = await res.json();
        toast.error(data.error || "저장 실패");
      }
    } catch { toast.error("저장 실패"); }
    setSaving(false);
  };

  const handleDelete = async (p: Program) => {
    if (!confirm(`"${p.title}" 프로그램을 삭제하시겠습니까?`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/programs/${p.id}`, { method: "DELETE" });
      if (res.ok) {
        setSelectedId(null);
        fetchPrograms();
      } else {
        const data = await res.json();
        toast.error(data.error || "삭제 실패");
      }
    } catch { toast.error("삭제 실패"); }
    setDeleting(false);
  };

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder((o) => (o === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
    setPage(1);
  };

  const totalPages = Math.ceil(total / limit);
  const isExpired = (d: string | null) => d ? new Date(d) < new Date() : false;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">프로그램 관리</h1>
          <p className="text-sm text-gray-500 mt-1">{total.toLocaleString()}개 정부지원사업</p>
        </div>
        <button
          onClick={handleCollect}
          disabled={collecting}
          className="h-10 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {collecting ? "수집 중..." : "수동 수집"}
        </button>
      </div>

      {/* 검색 + 필터 토글 */}
      <div className="flex gap-3 mb-3 flex-wrap">
        <form
          onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); setPage(1); }}
          className="flex gap-2 flex-1 min-w-[300px]"
        >
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="프로그램명, 기관명, 대상 검색..."
            className="flex-1 h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button type="submit" className="h-10 px-4 rounded-lg bg-gray-100 text-sm hover:bg-gray-200 font-medium">검색</button>
          {search && (
            <button type="button" onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }} className="h-10 px-3 rounded-lg text-sm text-gray-500 hover:bg-gray-100">
              초기화
            </button>
          )}
        </form>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`h-10 px-4 rounded-lg text-sm font-medium border transition-colors ${
            showFilters || activeFilterCount > 0
              ? "bg-blue-50 border-blue-200 text-blue-700"
              : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
          }`}
        >
          필터 {activeFilterCount > 0 && `(${activeFilterCount})`}
        </button>
      </div>

      {/* 필터 패널 */}
      {showFilters && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* 출처 */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">출처</label>
              <div className="flex gap-1 flex-wrap">
                {SOURCE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setSourceFilter(opt.value); setPage(1); }}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      sourceFilter === opt.value ? "bg-blue-100 text-blue-700" : "bg-white text-gray-500 hover:bg-gray-100 border border-gray-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 상태 */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">상태</label>
              <div className="flex gap-1 flex-wrap">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setStatusFilter(opt.value); setPage(1); }}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      statusFilter === opt.value ? "bg-blue-100 text-blue-700" : "bg-white text-gray-500 hover:bg-gray-100 border border-gray-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 기관 */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">주관기관</label>
              <select
                value={institutionFilter}
                onChange={(e) => { setInstitutionFilter(e.target.value); setPage(1); }}
                className="w-full h-8 rounded-md border border-gray-300 px-2 text-xs"
              >
                <option value="">전체 기관</option>
                {institutions.map((inst) => (
                  <option key={inst} value={inst}>{inst}</option>
                ))}
              </select>
            </div>

            {/* 정렬 */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">정렬</label>
              <div className="flex gap-1">
                <select
                  value={sortField}
                  onChange={(e) => { setSortField(e.target.value); setPage(1); }}
                  className="flex-1 h-8 rounded-md border border-gray-300 px-2 text-xs"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <button
                  onClick={() => setSortOrder((o) => (o === "desc" ? "asc" : "desc"))}
                  className="h-8 px-2 rounded-md border border-gray-300 text-xs hover:bg-gray-100"
                >
                  {sortOrder === "desc" ? "↓" : "↑"}
                </button>
              </div>
            </div>
          </div>

          {/* 마감일 범위 */}
          <div className="flex items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">마감일 범위</label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={applyEndFrom}
                  onChange={(e) => { setApplyEndFrom(e.target.value); setPage(1); }}
                  className="h-8 rounded-md border border-gray-300 px-2 text-xs"
                />
                <span className="text-xs text-gray-400">~</span>
                <input
                  type="date"
                  value={applyEndTo}
                  onChange={(e) => { setApplyEndTo(e.target.value); setPage(1); }}
                  className="h-8 rounded-md border border-gray-300 px-2 text-xs"
                />
              </div>
            </div>
            {activeFilterCount > 0 && (
              <button onClick={resetFilters} className="h-8 px-3 rounded-md text-xs text-red-500 hover:bg-red-50 border border-red-200">
                필터 초기화
              </button>
            )}
          </div>
        </div>
      )}

      {/* 빠른 필터 칩 (필터 패널 닫혀있을 때) */}
      {!showFilters && (
        <div className="flex gap-1 mb-4 flex-wrap">
          {SOURCE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setSourceFilter(opt.value); setPage(1); }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                sourceFilter === opt.value ? "bg-white text-gray-900 shadow-sm border border-gray-200" : "text-gray-500 hover:text-gray-700 bg-gray-100"
              }`}
            >
              {opt.label}
            </button>
          ))}
          <span className="w-px bg-gray-200 mx-1" />
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setStatusFilter(opt.value); setPage(1); }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                statusFilter === opt.value ? "bg-blue-100 text-blue-700" : "text-gray-500 hover:text-gray-700 bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th
                className="text-left px-4 py-3 font-medium text-gray-600 w-[40%] cursor-pointer hover:text-blue-600"
                onClick={() => toggleSort("title")}
              >
                프로그램명 {sortField === "title" && (sortOrder === "asc" ? "↑" : "↓")}
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">출처</th>
              <th
                className="text-left px-4 py-3 font-medium text-gray-600 cursor-pointer hover:text-blue-600"
                onClick={() => toggleSort("institution")}
              >
                주관기관 {sortField === "institution" && (sortOrder === "asc" ? "↑" : "↓")}
              </th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">상태</th>
              <th
                className="text-left px-4 py-3 font-medium text-gray-600 cursor-pointer hover:text-blue-600"
                onClick={() => toggleSort("apply_end")}
              >
                마감일 {sortField === "apply_end" && (sortOrder === "asc" ? "↑" : "↓")}
              </th>
              <th
                className="text-left px-4 py-3 font-medium text-gray-600 cursor-pointer hover:text-blue-600"
                onClick={() => toggleSort("collected_at")}
              >
                수집일 {sortField === "collected_at" && (sortOrder === "asc" ? "↑" : "↓")}
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto" />
                <p className="mt-2 text-sm">로딩 중...</p>
              </td></tr>
            ) : error ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center">
                <p className="text-sm text-red-500 mb-2">{error}</p>
                <button onClick={fetchPrograms} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700">다시 시도</button>
              </td></tr>
            ) : programs.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">결과 없음</td></tr>
            ) : programs.map((p) => {
              const selected = selectedId === p.id;
              return (
                <ProgramRow
                  key={p.id}
                  program={p}
                  selected={selected}
                  editMode={selected && editMode}
                  editForm={editForm}
                  saving={saving}
                  deleting={deleting}
                  isExpired={isExpired(p.apply_end)}
                  onToggle={() => toggleSelect(p.id)}
                  onEdit={() => startEdit(p)}
                  onSave={() => handleSave(p.id)}
                  onCancelEdit={() => setEditMode(false)}
                  onDelete={() => handleDelete(p)}
                  onFormChange={(key, val) => setEditForm({ ...editForm, [key]: val })}
                  sourceLabel={sourceLabel}
                />
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

/* 프로그램 행 + 상세/편집 패널 */
function ProgramRow({
  program: p,
  selected,
  editMode,
  editForm,
  saving,
  deleting,
  isExpired,
  onToggle,
  onEdit,
  onSave,
  onCancelEdit,
  onDelete,
  onFormChange,
  sourceLabel,
}: {
  program: Program;
  selected: boolean;
  editMode: boolean;
  editForm: Record<string, string>;
  saving: boolean;
  deleting: boolean;
  isExpired: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onSave: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  onFormChange: (key: string, val: string) => void;
  sourceLabel: (s: string) => string;
}) {
  // 마감 D-day 계산
  const getDday = () => {
    if (!p.apply_end) return null;
    const end = new Date(p.apply_end);
    const now = new Date();
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return null;
    if (diff === 0) return "D-Day";
    return `D-${diff}`;
  };

  const dday = getDday();

  return (
    <>
      <tr
        className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${selected ? "bg-blue-50 hover:bg-blue-50" : ""}`}
        onClick={onToggle}
      >
        <td className="px-4 py-3">
          <div className="font-medium text-gray-700 truncate max-w-[400px]">{p.title}</div>
          {p.target && <div className="text-xs text-gray-400 mt-0.5 truncate max-w-[400px]">{p.target}</div>}
        </td>
        <td className="px-4 py-3"><Badge variant="secondary" className="text-[10px]">{sourceLabel(p.source)}</Badge></td>
        <td className="px-4 py-3 text-gray-500 text-xs">{p.institution || "-"}</td>
        <td className="px-4 py-3 text-center">
          <div className="flex flex-col items-center gap-0.5">
            {isExpired
              ? <Badge variant="destructive" className="text-[10px]">마감</Badge>
              : <Badge variant="success" className="text-[10px]">진행중</Badge>}
            {dday && (
              <span className={`text-[10px] font-medium ${
                dday === "D-Day" ? "text-red-600" : parseInt(dday.replace("D-", "")) <= 7 ? "text-orange-500" : "text-blue-500"
              }`}>
                {dday}
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-gray-500 text-xs">{p.apply_end ? new Date(p.apply_end).toLocaleDateString("ko-KR") : "-"}</td>
        <td className="px-4 py-3 text-gray-400 text-xs">{new Date(p.collected_at).toLocaleDateString("ko-KR")}</td>
      </tr>

      {selected && (
        <tr>
          <td colSpan={6} className="bg-gray-50 px-4 py-4 border-b border-gray-200">
            {editMode ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <EditField label="프로그램명" value={editForm.title} onChange={(v) => onFormChange("title", v)} />
                  <EditField label="주관기관" value={editForm.institution} onChange={(v) => onFormChange("institution", v)} />
                  <EditField label="접수 시작일" value={editForm.apply_start} onChange={(v) => onFormChange("apply_start", v)} type="date" />
                  <EditField label="접수 마감일" value={editForm.apply_end} onChange={(v) => onFormChange("apply_end", v)} type="date" />
                </div>
                <EditField label="대상" value={editForm.target} onChange={(v) => onFormChange("target", v)} />
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">요약</label>
                  <textarea
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    value={editForm.summary || ""}
                    onChange={(e) => onFormChange("summary", e.target.value)}
                  />
                </div>
                <EditField label="상세 URL" value={editForm.detail_url} onChange={(v) => onFormChange("detail_url", v)} />
                <div className="flex gap-2">
                  <Button onClick={onSave} disabled={saving} size="sm">
                    {saving ? "저장 중..." : "저장"}
                  </Button>
                  <Button onClick={onCancelEdit} variant="outline" size="sm">취소</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-base">{p.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-[10px]">{sourceLabel(p.source)}</Badge>
                      {p.institution && <span className="text-xs text-gray-500">{p.institution}</span>}
                      {dday && (
                        <Badge variant={dday === "D-Day" ? "destructive" : "warning"} className="text-[10px]">
                          {dday}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button onClick={onEdit} variant="outline" size="sm" className="text-xs h-8">편집</Button>
                    <Button onClick={onDelete} variant="destructive" size="sm" disabled={deleting} className="text-xs h-8">
                      {deleting ? "삭제 중..." : "삭제"}
                    </Button>
                    {p.detail_url && (
                      <a href={p.detail_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                        className="h-8 px-3 rounded-lg bg-blue-50 text-xs font-medium text-blue-600 hover:bg-blue-100 inline-flex items-center">
                        원문 보기
                      </a>
                    )}
                  </div>
                </div>

                {p.target && (
                  <div><div className="text-xs font-semibold text-gray-500 mb-1">지원 대상</div><div className="text-sm text-gray-700">{p.target}</div></div>
                )}
                {p.summary && (
                  <div><div className="text-xs font-semibold text-gray-500 mb-1">요약</div><div className="text-sm text-gray-700 whitespace-pre-wrap">{p.summary}</div></div>
                )}

                <div className="grid grid-cols-3 gap-3">
                  <InfoCard label="접수 기간" value={`${p.apply_start ? new Date(p.apply_start).toLocaleDateString("ko-KR") : "미정"} ~ ${p.apply_end ? new Date(p.apply_end).toLocaleDateString("ko-KR") : "미정"}`} />
                  <InfoCard label="수집일" value={new Date(p.collected_at).toLocaleString("ko-KR")} />
                  <InfoCard label="출처 ID" value={p.source_id || "-"} mono />
                </div>

                {p.hashtags && p.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {p.hashtags.map((tag, i) => (
                      <span key={i} className="inline-block bg-blue-50 text-blue-600 text-[10px] px-2 py-0.5 rounded-full">#{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function EditField({ label, value, onChange, type = "text" }: { label: string; value?: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type={type}
        className="w-full h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function InfoCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-white rounded-lg border p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-sm font-medium mt-1 ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}

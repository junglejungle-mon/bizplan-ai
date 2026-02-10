"use client";

import { useEffect, useState, useCallback } from "react";

interface Program {
  id: string;
  title: string;
  status: string;
  category: string;
  deadline: string | null;
  support_amount: string | null;
  target: string | null;
  created_at: string;
}

export default function AdminProgramsPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const limit = 50;

  const fetchPrograms = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (search) params.set("search", search);
    const res = await fetch(`/api/admin/programs?${params}`);
    if (res.ok) {
      const data = await res.json();
      setPrograms(data.programs || []);
      setTotal(data.total || 0);
    }
    setLoading(false);
  }, [page, search]);

  useEffect(() => {
    fetchPrograms();
  }, [fetchPrograms]);

  const handleCollect = async () => {
    setCollecting(true);
    try {
      await fetch("/api/admin/programs", { method: "POST" });
      setTimeout(() => fetchPrograms(), 2000);
    } catch {}
    setCollecting(false);
  };

  const totalPages = Math.ceil(total / limit);

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

      {/* 검색 */}
      <div className="flex gap-3 mb-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(searchInput);
            setPage(1);
          }}
          className="flex gap-2 flex-1"
        >
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="프로그램명 검색..."
            className="flex-1 h-10 rounded-lg border border-gray-300 px-3 text-sm"
          />
          <button type="submit" className="h-10 px-4 rounded-lg bg-gray-100 text-sm hover:bg-gray-200">
            검색
          </button>
        </form>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-600">프로그램명</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">카테고리</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">지원금액</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">마감일</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">수집일</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">로딩 중...</td></tr>
            ) : programs.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">결과 없음</td></tr>
            ) : programs.map((p) => (
              <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-700 truncate max-w-[400px]">{p.title}</div>
                  {p.target && <div className="text-xs text-gray-400 mt-0.5 truncate max-w-[400px]">{p.target}</div>}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{p.category || "-"}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{p.support_amount || "-"}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {p.deadline ? new Date(p.deadline).toLocaleDateString("ko-KR") : "-"}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {new Date(p.created_at).toLocaleDateString("ko-KR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="h-8 px-3 rounded border text-sm disabled:opacity-50"
          >
            이전
          </button>
          <span className="text-sm text-gray-500">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="h-8 px-3 rounded border text-sm disabled:opacity-50"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}

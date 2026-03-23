"use client";

import { Fragment, useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";

interface UserSubscription {
  id: string;
  status: string;
  plan_id: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  plan: {
    name: string;
    display_name: string;
    price: number;
  } | null;
}

interface User {
  id: string;
  full_name: string | null;
  email: string;
  created_at: string;
  company: {
    id: string;
    company_name: string;
    industry: string | null;
    profile_score: number | null;
  } | null;
  planCount: number;
  subscription: UserSubscription | null;
}

const PLAN_BADGE: Record<string, { label: string; variant: "success" | "default" | "secondary" | "warning" }> = {
  free: { label: "무료", variant: "secondary" },
  pro: { label: "프로", variant: "success" },
  allfree: { label: "올프리", variant: "warning" },
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [userDetail, setUserDetail] = useState<Record<string, unknown> | null>(null);
  const limit = 50;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set("search", search);
    try {
      const res = await fetch(`/api/admin/users?${params}`);
      if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
      const data = await res.json();
      setUsers(data.users || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("사용자 목록 조회 실패:", err);
      setError(err instanceof Error ? err.message : "사용자 목록을 불러올 수 없습니다.");
    }
    setLoading(false);
  }, [page, search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSelectUser = async (userId: string) => {
    if (selectedUser === userId) {
      setSelectedUser(null);
      setUserDetail(null);
      return;
    }
    setSelectedUser(userId);
    setUserDetail(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setUserDetail(data);
      } else {
        console.error("사용자 상세 조회 실패:", res.status);
      }
    } catch (err) {
      console.error("사용자 상세 조회 오류:", err);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">사용자 관리</h1>
          <p className="text-sm text-gray-500 mt-1">{total.toLocaleString()}명 사용자</p>
        </div>
      </div>

      {/* 검색 */}
      <div className="flex gap-2 mb-4">
        <form
          onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); setPage(1); }}
          className="flex gap-2 flex-1"
        >
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="이름 또는 이메일 검색..."
            className="flex-1 h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent max-w-md"
          />
          <button type="submit" className="h-10 px-4 rounded-lg bg-gray-100 text-sm hover:bg-gray-200 font-medium">검색</button>
          {search && (
            <button type="button" onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }} className="h-10 px-3 rounded-lg text-sm text-gray-500 hover:bg-gray-100">
              초기화
            </button>
          )}
        </form>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-600">이름</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">이메일</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">기업</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">플랜</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">계획서</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">프로필</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">가입일</th>
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
                <button onClick={fetchUsers} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700">다시 시도</button>
              </td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">사용자 없음</td></tr>
            ) : users.map((user) => (
              <Fragment key={user.id}>
                <tr
                  className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
                    selectedUser === user.id ? "bg-blue-50 hover:bg-blue-50" : ""
                  }`}
                  onClick={() => handleSelectUser(user.id)}
                >
                  <td className="px-4 py-3 font-medium text-gray-700">{user.full_name || "미설정"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{user.email}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{user.company?.company_name || "-"}</td>
                  <td className="px-4 py-3 text-center">
                    {user.subscription?.plan ? (
                      <Badge variant={PLAN_BADGE[user.subscription.plan.name]?.variant || "secondary"} className="text-[10px]">
                        {user.subscription.plan.display_name}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">무료</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500">{user.planCount}건</td>
                  <td className="px-4 py-3 text-center">
                    <ProfileBar score={user.company?.profile_score || 0} />
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{new Date(user.created_at).toLocaleDateString("ko-KR")}</td>
                </tr>

                {/* 상세 펼침 */}
                {selectedUser === user.id && userDetail && (
                  <tr key={`${user.id}-detail`}>
                    <td colSpan={7} className="px-4 py-4 bg-gray-50 border-b border-gray-200">
                      <UserDetailPanel detail={userDetail} />
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
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 rounded-full bg-gray-200">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.min(score, 100)}%` }} />
      </div>
      <span className="text-[10px] text-gray-400">{score}%</span>
    </div>
  );
}

function UserDetailPanel({ detail }: { detail: Record<string, unknown> }) {
  const company = detail.company as Record<string, unknown> | null;
  const plans = (detail.plans as Array<Record<string, unknown>>) || [];
  const interviews = (detail.interviews as Array<Record<string, unknown>>) || [];
  const matchings = (detail.matchings as Array<Record<string, unknown>>) || [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 회사 정보 */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="text-xs font-semibold text-gray-500 mb-2">기업 정보</h3>
        {company ? (
          <>
            <div className="text-sm font-medium">{company.company_name as string || company.name as string}</div>
            <div className="text-xs text-gray-400 mt-1">
              {(company.industry as string) || "-"} | {(company.employee_count as string) || "-"}명
            </div>
            {company.profile_score != null && (
              <div className="mt-2">
                <ProfileBar score={company.profile_score as number} />
              </div>
            )}
          </>
        ) : (
          <div className="text-xs text-gray-400">미등록</div>
        )}
      </div>

      {/* 사업계획서 */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="text-xs font-semibold text-gray-500 mb-2">사업계획서 ({plans.length}건)</h3>
        {plans.length === 0 ? (
          <div className="text-xs text-gray-400">없음</div>
        ) : (
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {plans.map((plan) => (
              <div key={plan.id as string} className="text-xs">
                <span className="font-medium text-gray-700 truncate">{plan.title as string}</span>
                <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${
                  plan.status === "completed" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                }`}>{plan.status as string}</span>
                {plan.quality_score != null && (
                  <span className="ml-1 text-gray-400">{plan.quality_score as number}점</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 인터뷰 */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="text-xs font-semibold text-gray-500 mb-2">인터뷰 ({interviews.length}건)</h3>
        {interviews.length === 0 ? (
          <div className="text-xs text-gray-400">없음</div>
        ) : (
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {interviews.slice(0, 5).map((iv) => (
              <div key={iv.id as string} className="text-xs text-gray-500 truncate">
                {(iv.question as string)?.slice(0, 50) || "질문 없음"}
              </div>
            ))}
            {interviews.length > 5 && (
              <div className="text-[10px] text-gray-400">+{interviews.length - 5}건 더</div>
            )}
          </div>
        )}
      </div>

      {/* 매칭 */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="text-xs font-semibold text-gray-500 mb-2">프로그램 매칭 ({matchings.length}건)</h3>
        {matchings.length === 0 ? (
          <div className="text-xs text-gray-400">없음</div>
        ) : (
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {matchings.slice(0, 5).map((m) => {
              const prog = m.programs as Record<string, unknown> | null;
              return (
                <div key={m.id as string} className="text-xs text-gray-500 truncate">
                  {(prog?.title as string) || "프로그램 정보 없음"}
                </div>
              );
            })}
            {matchings.length > 5 && (
              <div className="text-[10px] text-gray-400">+{matchings.length - 5}건 더</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

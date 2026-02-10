"use client";

import { useEffect, useState } from "react";

interface User {
  id: string;
  full_name: string | null;
  email: string;
  created_at: string;
  company: { id: string; company_name: string } | null;
  planCount: number;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [userDetail, setUserDetail] = useState<any>(null);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data) => setUsers(data.users || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSelectUser = async (userId: string) => {
    if (selectedUser === userId) {
      setSelectedUser(null);
      setUserDetail(null);
      return;
    }
    setSelectedUser(userId);
    const res = await fetch(`/api/admin/users/${userId}`);
    if (res.ok) {
      const data = await res.json();
      setUserDetail(data);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">사용자 관리</h1>
      <p className="text-sm text-gray-500 mb-4">{users.length}명 사용자</p>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-600">이름</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">이메일</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">기업</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">계획서</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">가입일</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">로딩 중...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">사용자 없음</td></tr>
            ) : users.map((user) => (
              <>
                <tr
                  key={user.id}
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleSelectUser(user.id)}
                >
                  <td className="px-4 py-3 font-medium text-gray-700">{user.full_name || "미설정"}</td>
                  <td className="px-4 py-3 text-gray-500">{user.email}</td>
                  <td className="px-4 py-3 text-gray-500">{user.company?.company_name || "-"}</td>
                  <td className="px-4 py-3 text-gray-500">{user.planCount}건</td>
                  <td className="px-4 py-3 text-gray-400">{new Date(user.created_at).toLocaleDateString("ko-KR")}</td>
                </tr>
                {selectedUser === user.id && userDetail && (
                  <tr key={`${user.id}-detail`}>
                    <td colSpan={5} className="px-4 py-4 bg-gray-50">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* 회사 정보 */}
                        {userDetail.company && (
                          <div className="bg-white rounded-lg border p-4">
                            <h3 className="text-xs font-semibold text-gray-500 mb-2">기업 정보</h3>
                            <div className="text-sm font-medium">{userDetail.company.company_name}</div>
                            <div className="text-xs text-gray-400 mt-1">
                              {userDetail.company.industry || "-"} | {userDetail.company.employee_count || "-"}명
                            </div>
                          </div>
                        )}

                        {/* 사업계획서 */}
                        <div className="bg-white rounded-lg border p-4">
                          <h3 className="text-xs font-semibold text-gray-500 mb-2">사업계획서</h3>
                          {userDetail.plans?.length === 0 ? (
                            <div className="text-xs text-gray-400">없음</div>
                          ) : (
                            userDetail.plans?.map((plan: any) => (
                              <div key={plan.id} className="text-xs mb-1">
                                <span className="font-medium">{plan.title}</span>
                                <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${
                                  plan.status === "completed" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                                }`}>{plan.status}</span>
                                {plan.quality_score != null && (
                                  <span className="ml-1 text-gray-400">{plan.quality_score}점</span>
                                )}
                              </div>
                            ))
                          )}
                        </div>

                        {/* 인터뷰 */}
                        <div className="bg-white rounded-lg border p-4">
                          <h3 className="text-xs font-semibold text-gray-500 mb-2">
                            인터뷰 ({userDetail.interviews?.length || 0}건)
                          </h3>
                          {userDetail.interviews?.slice(0, 5).map((iv: any) => (
                            <div key={iv.id} className="text-xs text-gray-500 mb-1 truncate">
                              {iv.question?.slice(0, 40) || "질문 없음"}
                            </div>
                          ))}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

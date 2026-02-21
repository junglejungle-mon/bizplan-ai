"use client";

import { useEffect, useState } from "react";
import { Copy, Check, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ShareButton } from "@/components/referral/share-button";
import { ReferralStats } from "@/components/referral/referral-stats";
import { MilestoneCard } from "@/components/referral/milestone-card";
import { CreditBalance } from "@/components/referral/credit-balance";

interface ReferralData {
  code: string;
  referralLink: string;
  totalReferrals: number;
  successfulReferrals: number;
  creditsAvailable: number;
  creditsUsed: number;
  recentReferrals: Array<{
    id: string;
    status: string;
    createdAt: string;
    completedAt: string | null;
  }>;
  milestones: Array<{
    count: number;
    reward: string;
    description: string;
    achieved: boolean;
  }>;
}

export default function ReferralPage() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [codeCopied, setCodeCopied] = useState(false);

  useEffect(() => {
    fetch("/api/referral")
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleCopyCode = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      window.prompt("추천 코드를 복사하세요:", data.code);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-gray-200" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-gray-200" />
          ))}
        </div>
        <div className="h-48 animate-pulse rounded-xl bg-gray-200" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-600">추천 정보를 불러오는 데 실패했습니다</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 text-sm text-red-500 underline"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/dashboard"
            className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            대시보드
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">친구 추천</h1>
          <p className="mt-1 text-sm text-gray-500">
            친구를 추천하고 사업계획서 무료 크레딧을 받으세요
          </p>
        </div>
        <ShareButton referralCode={data.code} referralLink={data.referralLink} />
      </div>

      {/* 추천 코드 & 크레딧 */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* 추천 코드 카드 */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-medium text-gray-500">나의 추천 코드</h3>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
              <span className="text-2xl font-mono font-bold tracking-widest text-gray-900">
                {data.code}
              </span>
            </div>
            <button
              onClick={handleCopyCode}
              className="flex h-12 w-12 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
              title="코드 복사"
            >
              {codeCopied ? (
                <Check className="h-5 w-5 text-green-500" />
              ) : (
                <Copy className="h-5 w-5" />
              )}
            </button>
          </div>
          <p className="mt-3 text-xs text-gray-400">
            이 코드로 가입한 친구에게 사업계획서 1건이 무료!
          </p>
        </div>

        {/* 크레딧 잔액 */}
        <CreditBalance creditsAvailable={data.creditsAvailable} />
      </div>

      {/* 통계 */}
      <ReferralStats
        totalReferrals={data.totalReferrals}
        successfulReferrals={data.successfulReferrals}
        creditsAvailable={data.creditsAvailable}
        creditsUsed={data.creditsUsed}
      />

      {/* 보상 안내 + 마일스톤 */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* 보상 안내 */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900">추천 보상</h3>
          <div className="mt-4 space-y-4">
            <div className="flex items-start gap-3 rounded-lg bg-blue-50 p-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-600">
                3
              </div>
              <div>
                <p className="text-sm font-medium text-blue-900">
                  추천인 보상
                </p>
                <p className="text-xs text-blue-700">
                  친구가 가입하면 사업계획서 <strong>3건</strong> 무료 크레딧
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg bg-green-50 p-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100 text-sm font-bold text-green-600">
                1
              </div>
              <div>
                <p className="text-sm font-medium text-green-900">
                  피추천인 혜택
                </p>
                <p className="text-xs text-green-700">
                  추천 코드로 가입하면 사업계획서 <strong>1건</strong> 무료
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-500 leading-relaxed">
                • 크레딧은 사업계획서 생성 시 자동 차감됩니다<br />
                • 크레딧은 발급일로부터 90일간 유효합니다<br />
                • 부정 추천 적발 시 크레딧이 회수될 수 있습니다
              </p>
            </div>
          </div>
        </div>

        {/* 마일스톤 */}
        <MilestoneCard
          milestones={data.milestones}
          currentReferrals={data.successfulReferrals}
        />
      </div>

      {/* 최근 추천 이력 */}
      {data.recentReferrals.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900">최근 추천 내역</h3>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                  <th className="pb-2 font-medium">상태</th>
                  <th className="pb-2 font-medium">추천일</th>
                  <th className="pb-2 font-medium">완료일</th>
                </tr>
              </thead>
              <tbody>
                {data.recentReferrals.map((ref) => (
                  <tr key={ref.id} className="border-b border-gray-50">
                    <td className="py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          ref.status === "completed"
                            ? "bg-green-100 text-green-700"
                            : ref.status === "pending"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {ref.status === "completed"
                          ? "완료"
                          : ref.status === "pending"
                          ? "대기중"
                          : ref.status}
                      </span>
                    </td>
                    <td className="py-3 text-gray-600">
                      {new Date(ref.createdAt).toLocaleDateString("ko-KR")}
                    </td>
                    <td className="py-3 text-gray-600">
                      {ref.completedAt
                        ? new Date(ref.completedAt).toLocaleDateString("ko-KR")
                        : "-"}
                    </td>
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

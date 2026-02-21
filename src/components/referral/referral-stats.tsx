"use client";

import { Users, Gift, FileText, Trophy } from "lucide-react";

interface ReferralStatsProps {
  totalReferrals: number;
  successfulReferrals: number;
  creditsAvailable: number;
  creditsUsed: number;
}

export function ReferralStats({
  totalReferrals,
  successfulReferrals,
  creditsAvailable,
  creditsUsed,
}: ReferralStatsProps) {
  const stats = [
    {
      label: "총 추천",
      value: totalReferrals,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "가입 완료",
      value: successfulReferrals,
      icon: Trophy,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "보유 크레딧",
      value: creditsAvailable,
      suffix: "건",
      icon: Gift,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      label: "사용 크레딧",
      value: creditsUsed,
      suffix: "건",
      icon: FileText,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <div className={`rounded-lg ${stat.bg} p-2`}>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold text-gray-900">
              {stat.value}
              {stat.suffix && (
                <span className="text-sm font-normal text-gray-500">
                  {stat.suffix}
                </span>
              )}
            </p>
            <p className="mt-1 text-xs text-gray-500">{stat.label}</p>
          </div>
        );
      })}
    </div>
  );
}
